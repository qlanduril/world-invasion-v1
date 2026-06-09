import os
import sys
import argparse
import numpy as np
from PIL import Image

def detect_bg_color(img):
    """
    Sample corners of the image to detect the background color.
    """
    w, h = img.size
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((w - 1, 0)),
        img.getpixel((0, h - 1)),
        img.getpixel((w - 1, h - 1))
    ]
    bg = np.mean(corners, axis=0)
    return bg

def compute_color_distances(arr, bg_color):
    """
    Calculate Euclidean distance of each pixel from the background color in RGBA space.
    Pre-multiplies RGB by Alpha to ensure transparent pixels are treated identically.
    Returns a 2D array of distances normalized to [0, 1].
    """
    arr_float = arr.astype(float)
    # Pre-multiply RGB by Alpha to nullify color values in transparent pixels
    alpha_norm = arr_float[:, :, 3:4] / 255.0
    arr_float[:, :, :3] = arr_float[:, :, :3] * alpha_norm
    
    diff = arr_float - bg_color
    dist = np.sqrt(np.sum(diff**2, axis=2))
    # Normalize by maximum possible distance in RGBA space: sqrt(4 * 255^2) ≈ 510.0
    dist = dist / 510.0
    return dist

def smooth_signal(signal, window_size):
    """
    Smooth a 1D signal using a moving average window.
    """
    if window_size <= 1:
        return signal
    window = np.ones(window_size) / window_size
    smoothed = np.convolve(signal, window, mode='same')
    return smoothed

def fill_splits(splits, length, target_count, min_dist):
    """
    If we didn't find enough valleys, add split points in the middle of the largest segments
    until we reach the target_count of splits.
    """
    all_splits = [0] + splits + [length]
    while len(splits) < target_count:
        max_len = -1
        insert_idx = -1
        for i in range(len(all_splits) - 1):
            seg_len = all_splits[i+1] - all_splits[i]
            if seg_len > max_len:
                max_len = seg_len
                insert_idx = i
                
        # If the largest segment is too small to split, stop
        if max_len < min_dist * 2:
            break
            
        new_split = (all_splits[insert_idx] + all_splits[insert_idx+1]) // 2
        splits.append(new_split)
        splits.sort()
        all_splits = [0] + splits + [length]
        
    return splits

def find_valleys(signal, num_splits=None, min_dist=30, threshold=0.3):
    """
    Find local minima in a 1D signal to serve as partition boundaries.
    Uses local prominence/depth (difference between the valley and adjacent peaks)
    to select the best split points, preventing bias towards the image edges.
    """
    valleys = []
    for i in range(1, len(signal) - 1):
        if signal[i] < signal[i-1] and signal[i] < signal[i+1]:
            # Define search windows for left and right peaks around the valley
            left_window = signal[max(0, i - min_dist) : i]
            right_window = signal[i+1 : min(len(signal), i + min_dist + 1)]
            
            left_peak = np.max(left_window) if len(left_window) > 0 else signal[i]
            right_peak = np.max(right_window) if len(right_window) > 0 else signal[i]
            
            # Prominence/depth is the average height difference to the left and right peaks
            depth = ((left_peak - signal[i]) + (right_peak - signal[i])) / 2.0
            valleys.append((i, signal[i], depth))
            
    if not valleys:
        return []
        
    if num_splits is None:
        # Filter by depth threshold (valleys that have prominence >= threshold * max_prominence)
        max_depth = max(v[2] for v in valleys)
        depth_threshold = max_depth * threshold if max_depth > 0 else 0.0
        
        candidates = [v for v in valleys if v[2] >= depth_threshold]
        candidates = sorted(candidates, key=lambda x: x[0])
        
        selected = []
        for coord, val, depth in candidates:
            if all(abs(coord - s) >= min_dist for s in selected):
                selected.append(coord)
        return sorted(selected)
    else:
        # Sort valleys by depth (highest local depth/prominence first)
        valleys_sorted = sorted(valleys, key=lambda x: x[2], reverse=True)
        selected = []
        for coord, val, depth in valleys_sorted:
            if len(selected) >= num_splits:
                break
            if all(abs(coord - s) >= min_dist for s in selected):
                selected.append(coord)
                
        # Fill in splits if we couldn't find enough valleys
        if len(selected) < num_splits:
            print(f" -> Found only {len(selected)} clear valley(s). Generating remaining splits evenly.")
            selected = fill_splits(selected, len(signal), num_splits, min_dist)
            
        return sorted(selected)

def parse_color(color_str):
    """
    Parse hex string (like #0d1b2a) or comma-separated RGBA string into a numpy array.
    """
    if color_str.startswith('#'):
        hex_color = color_str.lstrip('#')
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        return np.array([rgb[0], rgb[1], rgb[2], 255])
    else:
        parts = [float(p) for p in color_str.split(',')]
        if len(parts) == 3:
            parts.append(255)
        return np.array(parts)

def print_ascii_signal(signal, splits, title="Signal Visualizer"):
    # Downsample signal to 80 characters width
    width = 80
    height = 7
    signal_len = len(signal)
    
    # Map splits to downsampled indices
    split_indices = set(int(s * width / signal_len) for s in splits)
    
    # Downsample signal values
    chunk_size = max(1, signal_len // width)
    downsampled = []
    for i in range(width):
        chunk = signal[i * chunk_size : (i + 1) * chunk_size]
        downsampled.append(np.mean(chunk) if len(chunk) > 0 else 0)
        
    max_val = max(downsampled) if max(downsampled) > 0 else 1.0
    
    print(f"\n--- {title} (Vertical lines '|' are detected splits) ---")
    for r in range(height, -1, -1):
        thresh = (r / height) * max_val
        line = ""
        for c in range(width):
            if c in split_indices:
                line += "|"
            elif downsampled[c] >= thresh:
                line += "*"
            else:
                line += " "
        print(line)
    print("-" * width)

def partition_by_polygon(img, dist_matrix, bg_color, alpha_thresh, cols, rows, trim, keep_bg, output_dir, verbose=False):
    """
    Partitions the spritesheet using a Voronoi polygon masking system.
    Detects sprite centers (initialized uniformly and refined using K-means on active pixels),
    then assigns each active pixel to its closest center (Voronoi cell partition).
    This prevents particles and overlapping bounds from bleeding into neighboring frames.
    """
    width, height = img.size
    
    # Get active pixel coordinates (Y, X)
    active_mask = (dist_matrix > (alpha_thresh / 510.0))
    y_coords, x_coords = np.where(active_mask)
    if len(y_coords) == 0:
        print("Error: No active pixels found. Try lowering --alpha-thresh.")
        return
        
    pts = np.stack([x_coords, y_coords], axis=1).astype(float) # (N, 2)
    
    # Initialize centers uniformly
    centers = []
    for r in range(rows):
        cy = (r + 0.5) * (height / rows)
        for c in range(cols):
            cx = (c + 0.5) * (width / cols)
            centers.append([cx, cy])
    centers = np.array(centers, dtype=float) # (K, 2)
    
    # K-Means refinement (5 iterations)
    for iteration in range(5):
        # Euclidean distance to all centers
        diffs = pts[:, np.newaxis, :] - centers[np.newaxis, :, :]
        dists = np.sqrt(np.sum(diffs**2, axis=2))
        labels = np.argmin(dists, axis=1)
        
        new_centers = []
        for k in range(len(centers)):
            assigned_pts = pts[labels == k]
            if len(assigned_pts) > 0:
                new_centers.append(np.mean(assigned_pts, axis=0))
            else:
                new_centers.append(centers[k])
        centers = np.array(new_centers)
        
    if verbose:
        print("Refined sprite state centroids:")
        for k, center in enumerate(centers):
            print(f"  Frame {k}: {center.round(1)}")
            
    # Assign all pixels in the image to their nearest center to build the mask
    grid_x, grid_y = np.meshgrid(np.arange(width), np.arange(height))
    all_pts = np.stack([grid_x.ravel(), grid_y.ravel()], axis=1) # (W*H, 2)
    
    # Compute nearest center for all pixels in chunks to avoid memory issues
    num_pixels = len(all_pts)
    chunk_size = 100000
    nearest_centers = np.zeros(num_pixels, dtype=int)
    for start_idx in range(0, num_pixels, chunk_size):
        end_idx = min(start_idx + chunk_size, num_pixels)
        chunk_pts = all_pts[start_idx:end_idx]
        diffs = chunk_pts[:, np.newaxis, :] - centers[np.newaxis, :, :]
        dists = np.sqrt(np.sum(diffs**2, axis=2))
        nearest_centers[start_idx:end_idx] = np.argmin(dists, axis=1)
        
    nearest_centers = nearest_centers.reshape((height, width))
    
    frame_count = 0
    # Final assignment and saving
    for k in range(len(centers)):
        # Find active pixels assigned to center k
        assigned_active = active_mask & (nearest_centers == k)
        ys, xs = np.where(assigned_active)
        if len(ys) == 0:
            continue
            
        x_min, x_max = np.min(xs), np.max(xs)
        y_min, y_max = np.min(ys), np.max(ys)
        
        cell_w = x_max - x_min + 1
        cell_h = y_max - y_min + 1
        
        # Crop the bounding box of the original image
        cell_arr = np.array(img.crop((x_min, y_min, x_max + 1, y_max + 1))).copy()
        
        # Mask out background pixels and pixels assigned to other centers
        cell_nearest = nearest_centers[y_min:y_max+1, x_min:x_max+1]
        cell_dist = dist_matrix[y_min:y_max+1, x_min:x_max+1]
        
        is_bg = (cell_dist <= (alpha_thresh / 510.0))
        is_other = (cell_nearest != k)
        
        if not keep_bg:
            cell_arr[is_bg | is_other] = [0, 0, 0, 0]
        else:
            cell_arr[is_other] = [0, 0, 0, 0]
            
        cleaned_cell = Image.fromarray(cell_arr)
        
        # Trim borders of the masked frame if requested
        if trim:
            non_transparent = (cell_arr[:, :, 3] > 0)
            ys_nt, xs_nt = np.where(non_transparent)
            if len(ys_nt) > 0:
                trimmed_cell = cleaned_cell.crop((np.min(xs_nt), np.min(ys_nt), np.max(xs_nt) + 1, np.max(ys_nt) + 1))
            else:
                trimmed_cell = cleaned_cell
        else:
            trimmed_cell = cleaned_cell
            
        frame_path = os.path.join(output_dir, f"frame_{frame_count}.png")
        trimmed_cell.save(frame_path)
        print(f" -> Saved frame_{frame_count}.png (polygon-cell center: {centers[k].round(1)}, size: {trimmed_cell.width}x{trimmed_cell.height})")
        frame_count += 1
        
    print(f"Success! Generated {frame_count} polygon-partitioned frames in '{output_dir}'.")

def partition_image(img_path, bg_color_str='auto', alpha_thresh=15, smooth_window=15, 
                    cols=None, rows=None, min_dist=30, threshold=0.3, split_axis='both', trim=True, keep_bg=False, method='valley', verbose=False):
    if not os.path.exists(img_path):
        print(f"Error: File '{img_path}' not found.")
        return

    # Load image and convert to RGBA
    img = Image.open(img_path).convert('RGBA')
    width, height = img.size
    print(f"Loaded image: {img_path} ({width}x{height})")
    
    arr = np.array(img)
    
    # 1. Determine background color
    if bg_color_str.lower() == 'auto':
        # Corner pixels
        corners = [
            arr[0, 0],
            arr[0, width - 1],
            arr[height - 1, 0],
            arr[height - 1, width - 1]
        ]
        # Average the corner pixel RGBA values
        bg_color = np.mean(corners, axis=0)
        # Pre-multiply the detected background color
        bg_color_float = bg_color.astype(float)
        bg_color_float[:3] = bg_color_float[:3] * (bg_color_float[3] / 255.0)
        bg_color = bg_color_float
        print(f"Automatically detected background color (pre-multiplied): RGBA={bg_color.round(1)}")
    else:
        bg_color = parse_color(bg_color_str)
        # Pre-multiply specified bg color if it's not auto
        bg_color_float = bg_color.astype(float)
        bg_color_float[:3] = bg_color_float[:3] * (bg_color_float[3] / 255.0)
        bg_color = bg_color_float
        print(f"Using specified background color (pre-multiplied): RGBA={bg_color}")
        
    # 2. Compute color distance matrix
    dist_matrix = compute_color_distances(arr, bg_color)
    
    if method == 'polygon':
        if cols is None and rows is None:
            print("Error: The 'polygon' method requires specifying target --cols and/or --rows to initialize sprite state centers.")
            return
        c_val = cols if cols is not None else 1
        r_val = rows if rows is not None else 1
        
        img_dir = os.path.dirname(os.path.abspath(img_path))
        img_filename = os.path.basename(img_path)
        img_name_without_ext = os.path.splitext(img_filename)[0]
        output_dir = os.path.join(img_dir, img_name_without_ext)
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"Using polygon partitioning method (cols={c_val}, rows={r_val})")
        partition_by_polygon(
            img=img,
            dist_matrix=dist_matrix,
            bg_color=bg_color,
            alpha_thresh=alpha_thresh,
            cols=c_val,
            rows=r_val,
            trim=trim,
            keep_bg=keep_bg,
            output_dir=output_dir,
            verbose=verbose
        )
        return
    
    # 3. Calculate row and column signals
    col_signals = np.mean(dist_matrix, axis=0)
    row_signals = np.mean(dist_matrix, axis=1)
    
    # 4. Smooth signals to filter high-frequency noise
    col_signals_smoothed = smooth_signal(col_signals, smooth_window)
    row_signals_smoothed = smooth_signal(row_signals, smooth_window)
    
    if method == 'grid':
        print(f"Using grid partitioning method (cols={cols}, rows={rows})")
        if split_axis in ['horizontal', 'both'] and cols is not None:
            x_splits = [int(i * width / cols) for i in range(1, cols)]
        if split_axis in ['vertical', 'both'] and rows is not None:
            y_splits = [int(i * height / rows) for i in range(1, rows)]
    else:
        if split_axis in ['horizontal', 'both']:
            x_splits = find_valleys(col_signals_smoothed, num_x_splits, min_dist, threshold)
            if verbose:
                print_ascii_signal(col_signals_smoothed, x_splits, "Horizontal (X-Axis) Color Signal")
        if split_axis in ['vertical', 'both']:
            y_splits = find_valleys(row_signals_smoothed, num_y_splits, min_dist, threshold)
            if verbose:
                print_ascii_signal(row_signals_smoothed, y_splits, "Vertical (Y-Axis) Color Signal")
        
    # Boundaries
    x_bounds = [0] + x_splits + [width]
    y_bounds = [0] + y_splits + [height]
    
    # Output directory
    img_dir = os.path.dirname(os.path.abspath(img_path))
    img_filename = os.path.basename(img_path)
    img_name_without_ext = os.path.splitext(img_filename)[0]
    output_dir = os.path.join(img_dir, img_name_without_ext)
    
    os.makedirs(output_dir, exist_ok=True)
    print(f"Calculated split boundaries:")
    print(f"  x-splits (vertical lines): {x_splits}")
    print(f"  y-splits (horizontal lines): {y_splits}")
    print(f"Saving frames to output directory: {output_dir}")
    
    frame_count = 0
    # Slice the image using the boundaries
    for r in range(len(y_bounds) - 1):
        y_start, y_end = y_bounds[r], y_bounds[r+1]
        for c in range(len(x_bounds) - 1):
            x_start, x_end = x_bounds[c], x_bounds[c+1]
            
            # Crop the cell
            cell = img.crop((x_start, y_start, x_end, y_end))
            
            # Analyze cell content (is it empty?)
            cell_arr = np.array(cell).copy()
            cell_dist = compute_color_distances(cell_arr, bg_color)
            
            # If the cell has some color variance from background, we save it
            # We check if there are at least some pixels that differ significantly from background
            significant_pixels = np.sum(cell_dist > (alpha_thresh / 510.0))
            if significant_pixels > 5:
                # Remove background (make background pixels transparent)
                if not keep_bg:
                    is_bg = (cell_dist <= (alpha_thresh / 510.0))
                    cell_arr[is_bg] = [0, 0, 0, 0]
                
                cleaned_cell = Image.fromarray(cell_arr)
                
                # Trim empty/background borders of the frame if requested
                if trim:
                    # To trim properly based on our distance metric, let's find the bounding box of non-background pixels
                    active_pixels = (cell_dist > (alpha_thresh / 510.0))
                    y_indices, x_indices = np.where(active_pixels)
                    if len(y_indices) > 0:
                        trimmed_cell = cleaned_cell.crop((np.min(x_indices), np.min(y_indices), np.max(x_indices) + 1, np.max(y_indices) + 1))
                    else:
                        trimmed_cell = cleaned_cell
                else:
                    trimmed_cell = cleaned_cell
                    
                frame_path = os.path.join(output_dir, f"frame_{frame_count}.png")
                trimmed_cell.save(frame_path)
                print(f" -> Saved frame_{frame_count}.png (cell: [{x_start}:{x_end}, {y_start}:{y_end}], size: {trimmed_cell.width}x{trimmed_cell.height})")
                frame_count += 1
                
    print(f"Success! Generated {frame_count} frames in '{output_dir}'.")

def main():
    parser = argparse.ArgumentParser(description="Partitions a spritesheet dynamically by analyzing color signals and valleys.")
    parser.add_argument("image_path", help="Path to the spritesheet PNG file.")
    parser.add_argument("--bg-color", default="auto", help="Background color to measure distance from (hex like '#0d1b2a', comma-separated RGBA, or 'auto').")
    parser.add_argument("--alpha-thresh", type=int, default=15, help="Color distance threshold (0-255) to consider a pixel active.")
    parser.add_argument("--smooth", type=int, default=15, help="Smoothing window size for the signal.")
    parser.add_argument("--cols", type=int, default=None, help="Target number of columns (forces finding cols-1 splits).")
    parser.add_argument("--rows", type=int, default=None, help="Target number of rows (forces finding rows-1 splits).")
    parser.add_argument("--min-dist", type=int, default=30, help="Minimum pixel distance between split lines.")
    parser.add_argument("--threshold", type=float, default=0.3, help="Valley selection threshold (0.0 to 1.0, bottom percentage of signal range).")
    parser.add_argument("--axis", choices=['horizontal', 'vertical', 'both'], default='both', help="Axes to split on.")
    parser.add_argument("--no-trim", action="store_false", dest="trim", help="Do not trim empty borders from the final output frames.")
    parser.add_argument("--keep-bg", action="store_true", help="Do not make the background pixels transparent in the output frames.")
    parser.add_argument("--method", choices=['valley', 'grid', 'polygon'], default='valley', help="Partitioning method: 'valley' (signal-based), 'grid' (uniform grid), or 'polygon' (Voronoi cell masking).")
    parser.add_argument("--verbose", action="store_true", help="Print ASCII visualization of the color intensity signal.")
    
    args = parser.parse_args()
    
    partition_image(
        img_path=args.image_path,
        bg_color_str=args.bg_color,
        alpha_thresh=args.alpha_thresh,
        smooth_window=args.smooth,
        cols=args.cols,
        rows=args.rows,
        min_dist=args.min_dist,
        threshold=args.threshold,
        split_axis=args.axis,
        trim=args.trim,
        keep_bg=args.keep_bg,
        method=args.method,
        verbose=args.verbose
    )

if __name__ == "__main__":
    main()
