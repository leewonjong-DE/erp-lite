#!/usr/bin/env python3
"""ERP-lite Next.js dev server start/stop helper."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PID_FILE = ROOT / ".dev-server.pid"
PORT = 3000
URL = f"http://localhost:{PORT}"


def npm_cmd() -> list[str]:
    if sys.platform == "win32":
        return ["cmd", "/c", "npm", "run", "dev"]
    return ["npm", "run", "dev"]


def is_running(pid: int) -> bool:
    if sys.platform == "win32":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        return str(pid) in result.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def pids_on_port(port: int) -> list[int]:
    pids: set[int] = set()
    if sys.platform == "win32":
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line.upper():
                parts = line.split()
                if parts:
                    try:
                        pids.add(int(parts[-1]))
                    except ValueError:
                        pass
    else:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True,
            text=True,
        )
        for pid in result.stdout.strip().split():
            if pid.isdigit():
                pids.add(int(pid))
    return sorted(pids)


def kill_pids(pids: list[int]) -> None:
    for pid in pids:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        else:
            try:
                os.kill(pid, 15)
            except OSError:
                pass


def cmd_start(_: argparse.Namespace) -> None:
    existing = pids_on_port(PORT)
    if existing:
        print(f"Already running on port {PORT} (PID {existing[0]})")
        print(URL)
        return

    if PID_FILE.exists():
        PID_FILE.unlink()

    kwargs: dict = {"cwd": ROOT, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

    proc = subprocess.Popen(npm_cmd(), **kwargs)
    PID_FILE.write_text(str(proc.pid), encoding="utf-8")

    for _ in range(30):
        time.sleep(0.5)
        if pids_on_port(PORT):
            print(f"Started dev server (PID {proc.pid})")
            print(URL)
            return

    print(f"Server starting... PID {proc.pid}")
    print(f"If ready, open {URL}")


def cmd_stop(_: argparse.Namespace) -> None:
    pids = pids_on_port(PORT)
    if not pids and PID_FILE.exists():
        saved = PID_FILE.read_text(encoding="utf-8").strip()
        if saved.isdigit():
            pids = [int(saved)]

    if not pids:
        if PID_FILE.exists():
            PID_FILE.unlink()
        print("Dev server is not running.")
        return

    kill_pids(pids)
    if PID_FILE.exists():
        PID_FILE.unlink()
    print(f"Stopped dev server (port {PORT})")


def cmd_status(_: argparse.Namespace) -> None:
    pids = pids_on_port(PORT)
    if pids:
        print(f"Running on port {PORT} — PID {', '.join(map(str, pids))}")
        print(URL)
    else:
        print("Dev server is not running.")


def cmd_restart(args: argparse.Namespace) -> None:
    cmd_stop(args)
    time.sleep(1)
    cmd_start(args)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ERP-lite dev server control",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py start
  python run.py stop
  python run.py status
  python run.py restart
        """,
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("start", help="Start dev server (npm run dev)").set_defaults(func=cmd_start)
    sub.add_parser("stop", help="Stop dev server on port 3000").set_defaults(func=cmd_stop)
    sub.add_parser("status", help="Check if dev server is running").set_defaults(func=cmd_status)
    sub.add_parser("restart", help="Restart dev server").set_defaults(func=cmd_restart)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
