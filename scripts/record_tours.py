from playwright.sync_api import sync_playwright
import os, shutil, subprocess, time

SCENES = { 'sets': 17.5, 'decks': 15.5, 'trade': 20.5, 'hero': 9.6 }
OUT = '/Users/wren/nova/rarebox/public/videos'
os.makedirs('/tmp/tourrec', exist_ok=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    for scene, dur in SCENES.items():
        for theme in ('light', 'dark'):
            ctx = b.new_context(viewport={'width': 1280, 'height': 720},
                                record_video_dir='/tmp/tourrec',
                                record_video_size={'width': 1280, 'height': 720})
            page = ctx.new_page()
            page.goto(f'file:///Users/wren/nova/rarebox/scripts/tour-stage.html?scene={scene}&theme={theme}')
            time.sleep(dur)
            video = page.video
            page.close()
            ctx.close()
            path = video.path()
            dst = f'/tmp/tourrec/{scene}-{theme}.webm'
            shutil.move(path, dst)
            print(f'recorded {scene}-{theme}', flush=True)
    b.close()

# encode
for scene in ('sets', 'decks', 'trade'):
    for theme in ('light', 'dark'):
        src = f'/tmp/tourrec/{scene}-{theme}.webm'
        out = f'{OUT}/{scene}-tour-{theme}.mp4'
        subprocess.run(['ffmpeg', '-y', '-i', src, '-ss', '0.4', '-c:v', 'libx264', '-crf', '24',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out],
                       check=True, capture_output=True)
        print('encoded', out, os.path.getsize(out)//1024, 'KB', flush=True)

# hero gifs for README
for theme in ('light', 'dark'):
    src = f'/tmp/tourrec/hero-{theme}.webm'
    pal = f'/tmp/tourrec/pal-{theme}.png'
    out = f'/Users/wren/nova/rarebox/assets/rarebox-intro-{theme}.gif'
    subprocess.run(['ffmpeg', '-y', '-i', src, '-ss', '0.4', '-vf', 'fps=16,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff', pal], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-i', src, '-i', pal, '-ss', '0.4', '-lavfi', 'fps=16,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', out], check=True, capture_output=True)
    print('gif', out, os.path.getsize(out)//1024, 'KB', flush=True)
print('ALL DONE')
