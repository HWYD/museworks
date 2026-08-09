import pytest

from museworks_agent import cli


def test_parse_port_uses_the_safe_default() -> None:
    assert cli.parse_port(None) == 8765


@pytest.mark.parametrize("value", ["1", "8765", "65535"])
def test_parse_port_accepts_ascii_decimal_ports(value: str) -> None:
    assert cli.parse_port(value) == int(value)


@pytest.mark.parametrize("value", ["", "0", "65536", "1.5", " 8765", "１２３"])
def test_parse_port_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValueError, match="MUSEWORKS_AGENT_PORT"):
        cli.parse_port(value)


def test_main_runs_the_existing_app_on_loopback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    def fake_run(app_path: str, **options: object) -> None:
        calls.append((app_path, options))

    monkeypatch.setenv("MUSEWORKS_AGENT_PORT", "9001")
    monkeypatch.setattr(cli.uvicorn, "run", fake_run)

    cli.main(["--reload"])

    assert calls == [
        (
            "museworks_agent.main:app",
            {"host": "127.0.0.1", "port": 9001, "reload": True},
        )
    ]


def test_main_exits_nonzero_for_an_invalid_environment_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MUSEWORKS_AGENT_PORT", "65536")

    with pytest.raises(SystemExit) as error:
        cli.main([])

    assert error.value.code == 2
