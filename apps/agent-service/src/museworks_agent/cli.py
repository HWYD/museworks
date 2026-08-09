from __future__ import annotations

import argparse
import os
from collections.abc import Sequence

import uvicorn

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
PORT_ENV = "MUSEWORKS_AGENT_PORT"


def parse_port(value: str | None) -> int:
    if value is None:
        return DEFAULT_PORT
    if not value.isascii() or not value.isdecimal():
        raise ValueError(f"{PORT_ENV} must be an ASCII decimal port in 1..65535")
    port = int(value)
    if not 1 <= port <= 65535:
        raise ValueError(f"{PORT_ENV} must be an ASCII decimal port in 1..65535")
    return port


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="museworks-agent")
    parser.add_argument("--reload", action="store_true")
    arguments = parser.parse_args(argv)

    try:
        port = parse_port(os.environ.get(PORT_ENV))
    except ValueError as error:
        parser.error(str(error))

    uvicorn.run(
        "museworks_agent.main:app",
        host=HOST,
        port=port,
        reload=arguments.reload,
    )


if __name__ == "__main__":
    main()
