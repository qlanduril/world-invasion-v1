import numpy as np
from PIL import Image

img = Image.open('src/assets/city_background_topdown_red.png')
data = np.array(img)
R, G, B = data[:,:,0], data[:,:,1], data[:,:,2]
red_mask = (R > np.maximum(G, B) + 40) & (R > 100)
mask_img = Image.fromarray((red_mask * 255).astype(np.uint8))
mask_img.save('src/assets/debug_mask.png')
