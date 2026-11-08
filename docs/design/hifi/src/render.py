import sys,subprocess,os,importlib
sys.path.insert(0,os.path.dirname(__file__))
from kit import page
def shot(htmlpath,png,w,h):
    subprocess.run(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=2',f'--window-size={w},{h}',f'--screenshot={png}','--virtual-time-budget=2000','file://'+htmlpath],check=True,capture_output=True)
