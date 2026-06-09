from PIL import Image
import numpy as np

img = Image.open('src/assets/city_background_topdown.png')
img = img.convert('HSV')
data = np.array(img)

# Grey means low saturation
# H is 0-255, S is 0-255, V is 0-255 in PIL/numpy HSV
H, S, V = data[:,:,0], data[:,:,1], data[:,:,2]
mask = (S < 40) & (V > 50) & (V < 200)

from scipy.ndimage import label, find_objects
labels, num = label(mask)
objects = find_objects(labels)

for i, slice_tuple in enumerate(objects):
    y_slice, x_slice = slice_tuple
    h = y_slice.stop - y_slice.start
    w = x_slice.stop - x_slice.start
    if w > 20 and h > 20: # filter out noise
        cx = (x_slice.start + x_slice.stop) / 2
        cy = (y_slice.start + y_slice.stop) / 2
        print(f"Rect: x={x_slice.start}, y={y_slice.start}, w={w}, h={h}, cx={cx}, cy={cy}")

