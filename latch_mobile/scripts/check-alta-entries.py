#!/usr/bin/env python3
"""Verbose, read-only entry discovery using the shared local Alta diagnostic."""

import runpy
import sys
from pathlib import Path

if __name__ == '__main__':
    sys.argv.insert(1, '--entries')
    diagnostic = runpy.run_path(str(Path(__file__).with_name('check-alta-profile.py')))
    try:
        sys.exit(diagnostic['main']())
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled.')
        sys.exit(130)
