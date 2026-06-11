"""Record the tour-stage scenes into the mp4s the app ships.

    python3 scripts/record_tours.py [scene ...]   # default: all scenes

Needs playwright (+ chromium) and ffmpeg on PATH. Scenes live in
tour-stage.html; each records in light and dark at 1280x720. The stage
sets body[data-started] when its image preload finishes and the
animation actually begins — recordings are trimmed to that moment, so
slow networks don't leave dead air at the front.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os, shutil, subprocess, sys, time

REPO = Path(__file__).resolve().parent.parent
STAGE = (REPO / 'scripts' / 'tour-stage.html').as_uri()
OUT = REPO / 'public' / 'videos'
TMP = Path('/tmp/tourrec')

SCENES = {'sets': 17.5, 'decks': 15.5, 'trade': 20.5, 'booth': 20.5, 'hero': 9.6}
chosen = sys.argv[1:] or list(SCENES)

TMP.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

def probe_duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'csv=p=0', str(path)], check=True, capture_output=True, text=True)
    return float(r.stdout.strip())

timing = {}  # (scene, theme) -> (offset_from_page_open, wall_total)
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    for scene in chosen:
        dur = SCENES[scene]
        for theme in ('light', 'dark'):
            ctx = b.new_context(viewport={'width': 1280, 'height': 720},
                                record_video_dir=str(TMP),
                                record_video_size={'width': 1280, 'height': 720})
            t0 = time.time()
            page = ctx.new_page()
            page.goto(f'{STAGE}?scene={scene}&theme={theme}', wait_until='domcontentloaded')
            page.wait_for_selector('body[data-started]', timeout=60000)
            offset = time.time() - t0
            time.sleep(dur)
            wall = time.time() - t0
            video = page.video
            page.close()
            ctx.close()
            timing[(scene, theme)] = (offset, wall)
            shutil.move(video.path(), TMP / f'{scene}-{theme}.webm')
            print(f'recorded {scene}-{theme} (start offset {offset:.2f}s, wall {wall:.2f}s)', flush=True)
    b.close()

# encode — Playwright's screencast on slow/software-rendered boxes writes
# fewer real frames than the 25fps container claims, which plays back in
# slow motion. Retime by the measured wall-clock factor before trimming.
for scene in chosen:
    if scene == 'hero':
        continue
    for theme in ('light', 'dark'):
        src = TMP / f'{scene}-{theme}.webm'
        out = OUT / f'{scene}-tour-{theme}.mp4'
        offset, wall = timing[(scene, theme)]
        factor = probe_duration(src) / wall
        start = max(0.0, offset - 0.1)
        vf = f'setpts=PTS/{factor:.4f},fps=30,trim=start={start:.2f},setpts=PTS-STARTPTS'
        subprocess.run(['ffmpeg', '-y', '-i', str(src), '-vf', vf, '-c:v', 'libx264', '-crf', '24',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(out)],
                       check=True, capture_output=True)
        print(f'encoded {out} {os.path.getsize(out) // 1024} KB (retime x{factor:.2f})', flush=True)

# hero gifs for README
if 'hero' in chosen:
    for theme in ('light', 'dark'):
        src = TMP / f'hero-{theme}.webm'
        pal = TMP / f'pal-{theme}.png'
        out = REPO / 'assets' / f'rarebox-intro-{theme}.gif'
        trim = f'{max(0.0, offsets[("hero", theme)] - 0.1):.2f}'
        subprocess.run(['ffmpeg', '-y', '-i', str(src), '-ss', trim, '-vf', 'fps=16,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff', str(pal)], check=True, capture_output=True)
        subprocess.run(['ffmpeg', '-y', '-i', str(src), '-i', str(pal), '-ss', trim, '-lavfi', 'fps=16,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', str(out)], check=True, capture_output=True)
        print('gif', out, os.path.getsize(out) // 1024, 'KB', flush=True)
print('ALL DONE')
