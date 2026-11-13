"""Windows launcher source gate. Runs on CI Linux; never executes a Windows shell."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parent.parent
class WindowsLauncherTests(unittest.TestCase):
    def test_local_only_and_optional_auto_browser(self):
        cmd=(ROOT/"scripts/open-local-fit-preview-windows.cmd").read_text(encoding="utf-8")
        server=(ROOT/"scripts/serve-private-fit-preview.py").read_text(encoding="utf-8")
        self.assertIn('cd /d "%~dp0.."',cmd)
        self.assertIn('"scripts\\serve-private-fit-preview.py"',cmd)
        self.assertEqual(cmd.count("--host 127.0.0.1 --port 0 --open-browser"),2)
        self.assertIn('py -3 -c "import sys;',cmd)
        self.assertIn('python -c "import sys;',cmd)
        self.assertIn("sys.version_info.major == 3",cmd)
        self.assertEqual(cmd.count('if not errorlevel 1 ('),4)
        self.assertNotIn("--allow-insecure-lan",cmd)
        for dangerous in ["netsh","powershell -enc","curl ","Invoke-WebRequest","0.0.0.0","--host 192.168."]:
            self.assertNotIn(dangerous,cmd)
        self.assertIn('p.add_argument("--open-browser"',server)
        self.assertIn('if args.host != "127.0.0.1":',server)
        self.assertIn("webbrowser.open(url)",server)
        self.assertIn("if not addr.is_loopback and not allow_insecure_lan:",server)
        self.assertIn("argparse",server)
        self.assertIn("server.serve_forever",server)

if __name__=="__main__":
    unittest.main()
