import zlib
import struct
import math
import os

def create_png(width, height, output_path):
    raw_data = bytearray()
    
    # Indigo gradient background (#4f46e5 to #8b5cf6) with rounded rect badge
    c1 = (79, 70, 229)
    c2 = (139, 92, 246)
    
    corner_radius = width * 0.22
    
    for y in range(height):
        raw_data.append(0)  # Filter type None
        t = y / max(1, height - 1)
        bg_r = int(c1[0] * (1 - t) + c2[0] * t)
        bg_g = int(c1[1] * (1 - t) + c2[1] * t)
        bg_b = int(c1[2] * (1 - t) + c2[2] * t)
        
        for x in range(width):
            # Check rounded corner
            dx = min(x, width - 1 - x)
            dy = min(y, height - 1 - y)
            
            alpha = 255
            if dx < corner_radius and dy < corner_radius:
                dist = math.sqrt((corner_radius - dx)**2 + (corner_radius - dy)**2)
                if dist > corner_radius:
                    alpha = 0
                elif dist > corner_radius - 1:
                    alpha = int(255 * (corner_radius - dist))
            
            # Simple icon graphic in center (Stamp Award Ribbon)
            cx, cy = width / 2.0, height / 2.0
            dist_c = math.sqrt((x - cx)**2 + (y - cy * 0.9)**2)
            
            r, g, b = bg_r, bg_g, bg_b
            if alpha > 0:
                # Outer circle
                if dist_c <= width * 0.28:
                    r, g, b = 255, 255, 255
                if dist_c <= width * 0.20:
                    r, g, b = 99, 102, 241
                if dist_c <= width * 0.14:
                    r, g, b = 255, 255, 255
                
                # Bottom ribbons
                if y > cy and abs(x - cx) < width * 0.20:
                    ribbon_w = (y - cy) * 0.6
                    if abs(abs(x - cx) - width * 0.08) < ribbon_w and y < height * 0.85:
                        r, g, b = 255, 255, 255
            
            raw_data.extend((r, g, b, alpha))
            
    compressed = zlib.compress(bytes(raw_data), 9)
    
    def make_chunk(chunk_type, data):
        length = struct.pack('>I', len(data))
        crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return length + chunk_type + data + crc
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(make_chunk(b'IHDR', ihdr_data))
    # IDAT
    png.extend(make_chunk(b'IDAT', compressed))
    # IEND
    png.extend(make_chunk(b'IEND', b''))
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(png)
    print(f"Generated {output_path} ({width}x{height})")

def make_ico(png_32_path, ico_path):
    with open(png_32_path, 'rb') as f:
        png_data = f.read()
    
    # ICO header (1 image)
    ico = bytearray(struct.pack('<HHH', 0, 1, 1))
    # Directory entry
    ico.extend(struct.pack('<BBBBHHII', 32, 32, 0, 0, 1, 32, len(png_data), 6 + 16))
    ico.extend(png_data)
    with open(ico_path, 'wb') as f:
        f.write(ico)
    print(f"Generated {ico_path}")

icons_dir = r"c:\Users\hajin\OneDrive\바탕 화면\code\project\imphoto-lab\stamp-tour\assets\icons"
create_png(16, 16, os.path.join(icons_dir, "favicon-16x16.png"))
create_png(32, 32, os.path.join(icons_dir, "favicon-32x32.png"))
create_png(180, 180, os.path.join(icons_dir, "apple-touch-icon.png"))
create_png(192, 192, os.path.join(icons_dir, "icon-192x192.png"))
create_png(512, 512, os.path.join(icons_dir, "icon-512x512.png"))
make_ico(os.path.join(icons_dir, "favicon-32x32.png"), os.path.join(icons_dir, "favicon.ico"))
make_ico(os.path.join(icons_dir, "favicon-32x32.png"), r"c:\Users\hajin\OneDrive\바탕 화면\code\project\imphoto-lab\stamp-tour\favicon.ico")
