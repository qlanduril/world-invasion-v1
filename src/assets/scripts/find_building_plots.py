import json
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects

def find_plots():
    img = Image.open('src/assets/city_background_topdown_red.png')
    data = np.array(img)
    R, G, B = data[:,:,0], data[:,:,1], data[:,:,2]

    # Find explicitly marked red areas
    red_mask = (R > np.maximum(G, B) + 40) & (R > 100)

    labels, num = label(red_mask)
    objects = find_objects(labels)
    
    plots = []
    
    width = img.width
    height = img.height

    for i, slice_tuple in enumerate(objects):
        if slice_tuple is None: continue
        y_slice, x_slice = slice_tuple
        h = y_slice.stop - y_slice.start
        w = x_slice.stop - x_slice.start
        
        # Filter for building footprints - LOOSENED THRESHOLDS
        if 20 < w < 400 and 20 < h < 400:
            cx_px = (x_slice.start + x_slice.stop) / 2.0
            cy_px = (y_slice.start + y_slice.stop) / 2.0
            
            ratio_x = cx_px / width
            ratio_y = cy_px / height
            
            zone = 'school'
            bw, bl = 3, 2
            if w > 100 or h > 100:
                zone = 'hospital'
                bw, bl = 2, 2
                
            plots.append({
                "ratioX": ratio_x,
                "ratioY": ratio_y,
                "zone": zone,
                "size": f"{bw}x{bl}"
            })
            
    with open('src/assets/map_data.json', 'w') as f:
        json.dump(plots, f, indent=2)
    print(f"Found {len(plots)} plots. Saved to src/assets/map_data.json")

if __name__ == '__main__':
    find_plots()
