"""Record the tour-stage scenes into the mp4s the app ships.

    python3 scripts/record_tours.py [scene ...]   # default: all scenes

Needs playwright (+ chromium) and ffmpeg on PATH.

Frames are captured one by one under CDP virtual time: the page's clock
only advances in exact 1/FPS steps between screenshots, so the encoded
video is perfectly smooth and identically timed on any machine — fast
or slow, GPU or software rendering. (Playwright's built-in screencast
only emits frames on repaint, which on slow boxes turns into a choppy,
unevenly-timed recording — don't go back to it.)
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import base64, os, shutil, subprocess, sys, threading, time

REPO = Path(__file__).resolve().parent.parent
STAGE = (REPO / 'scripts' / 'tour-stage.html').as_uri()
OUT = REPO / 'public' / 'videos'
TMP = Path('/tmp/tourrec')

SCENES = {'sets': 17.5, 'decks': 15.5, 'trade': 20.5, 'booth': 20.5, 'hero': 9.6}
FPS = 30
chosen = sys.argv[1:] or list(SCENES)

OUT.mkdir(parents=True, exist_ok=True)

# Deterministic-rendering flags: flush every compositor stage before each
# screenshot so virtual-time frames are complete, not mid-raster.
ARGS = [
    '--run-all-compositor-stages-before-draw',
    '--disable-new-content-rendering-timeout',
    '--disable-threaded-animation',
    '--disable-threaded-scrolling',
    '--disable-checker-imaging',
]


def record(b, scene, theme):
    frames_dir = TMP / f'{scene}-{theme}'
    shutil.rmtree(frames_dir, ignore_errors=True)
    frames_dir.mkdir(parents=True)

    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    page = ctx.new_page()
    page.goto(f'{STAGE}?scene={scene}&theme={theme}&manual=1', wait_until='domcontentloaded')
    page.wait_for_selector('body[data-ready]', timeout=60000)

    cdp = ctx.new_cdp_session(page)
    expired = threading.Event()
    cdp.on('Emulation.virtualTimeBudgetExpired', lambda _: expired.set())

    cdp.send('Emulation.setVirtualTimePolicy', {'policy': 'pause'})
    page.evaluate('window.__go()')

    total = int(SCENES[scene] * FPS)
    budget = 1000 / FPS
    t0 = time.time()
    for i in range(total):
        expired.clear()
        cdp.send('Emulation.setVirtualTimePolicy', {'policy': 'advance', 'budget': budget})
        while not expired.wait(0.05):
            page.wait_for_timeout(1)  # pump events if the driver is idle
        shot = cdp.send('Page.captureScreenshot', {'format': 'jpeg', 'quality': 92})
        (frames_dir / f'{i:05d}.jpg').write_bytes(base64.b64decode(shot['data']))
    ctx.close()
    print(f'captured {scene}-{theme}: {total} frames in {time.time() - t0:.0f}s wall', flush=True)
    return frames_dir


with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=ARGS)
    for scene in chosen:
        for theme in ('light', 'dark'):
            frames_dir = record(b, scene, theme)
            if scene == 'hero':
                pal = TMP / f'pal-{theme}.png'
                out = REPO / 'assets' / f'rarebox-intro-{theme}.gif'
                subprocess.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', str(frames_dir / '%05d.jpg'),
                                '-vf', 'fps=16,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff', str(pal)],
                               check=True, capture_output=True)
                subprocess.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', str(frames_dir / '%05d.jpg'), '-i', str(pal),
                                '-lavfi', 'fps=16,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', str(out)],
                               check=True, capture_output=True)
                print('gif', out, os.path.getsize(out) // 1024, 'KB', flush=True)
            else:
                out = OUT / f'{scene}-tour-{theme}.mp4'
                subprocess.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', str(frames_dir / '%05d.jpg'),
                                '-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p',
                                '-movflags', '+faststart', '-an', str(out)],
                               check=True, capture_output=True)
                print('encoded', out, os.path.getsize(out) // 1024, 'KB', flush=True)
    b.close()
print('ALL DONE')
