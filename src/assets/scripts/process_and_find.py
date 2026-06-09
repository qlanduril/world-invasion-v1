import json
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects

def process():
    # 1. Crop the image to exactly 1008x1008 to remove the black border
    img = Image.open('src/assets/city_background3.png')
    cropped = img.crop((8, 8, 1016, 1016))
    cropped.save('src/assets/city_background3_processed.png')
    print("Cropped image to 1008x1008 and saved as city_background3_processed.png")

    # 2. Find red plots on the processed image
    data = np.array(cropped)
    R, G, B = data[:,:,0], data[:,:,1], data[:,:,2]
    
    # Detect red color
    red_mask = (R > np.maximum(G, B) + 40) & (R > 100)
    
    labels, num = label(red_mask)
    objects = find_objects(labels)
    
    plots = []
    width = cropped.width
    height = cropped.height

    for i, slice_tuple in enumerate(objects):
        if slice_tuple is None: continue
        y_slice, x_slice = slice_tuple
        h = y_slice.stop - y_slice.start
        w = x_slice.stop - x_slice.start
        
        # We loosen the footprint filter to catch smaller red squares (e.g., width down to 8px)
        if 5 < w < 100 and 5 < h < 100:
            cx_px = (x_slice.start + x_slice.stop) / 2.0
            cy_px = (y_slice.start + y_slice.stop) / 2.0
            
            ratio_x = cx_px / width
            ratio_y = cy_px / height
            
            # The red squares in this image look like small residential plots
            # Let's map them all to schools/hospitals based on size.
            # If they are very small (e.g. w < 25), maybe they are houses (size 1x1)?
            # Let's see the size distribution first!
            plots.append({
                "ratioX": ratio_x,
                "ratioY": ratio_y,
                "w": w,
                "h": h
            })

    print(f"Found {len(plots)} raw plots. Sizes:")
    for p in plots[:10]:
        print(f"  w={p['w']}, h={p['h']} at ({p['ratioX']:.3f}, {p['ratioY']:.3f})")
    
    # Let's define the zone and size based on the plot dimensions.
    # If the plot is small, say w < 25, let's treat it as a 1x1 or 2x2.
    # Looking at the image, they all look roughly the same size.
    final_plots = []
    for p in plots:
        # Let's classify them.
        # Let's use '1' (hospital, 2x2) and '3' (school, 3x2) based on user's buildings.
        # Actually, let's look at the actual building definitions:
        # '1': Hospital (2x2)
        # '3': School (3x2)
        # Let's default them all to Hospital (2x2) for now, or mix them.
        # Let's assign zone/size:
        zone = 'hospital'
        size = '2x2'
        
        # If w > 20, maybe it's a school (3x2)
        if p['w'] > 20:
            zone = 'school'
            size = '3x2'
            
        final_plots.append({
            "ratioX": p['ratioX'],
            "ratioY": p['ratioY'],
            "zone": zone,
            "size": size
        })
        
    with open('src/assets/map_data.json', 'w') as f:
        json.dump(final_plots, f, indent=2)
    print(f"Saved {len(final_plots)} plots to src/assets/map_data.json")

if __name__ == '__main__':
    process()
