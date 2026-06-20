#!/usr/bin/env python3
"""Regression coverage for failed meta-deck card resolution."""

import ast
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


source_path = Path(__file__).resolve().parents[1] / "build_meta_decks.py"
tree = ast.parse(source_path.read_text())
function = next(
    node
    for node in tree.body
    if isinstance(node, ast.FunctionDef) and node.name == "resolve_cards_parallel"
)
namespace = {
    "ThreadPoolExecutor": ThreadPoolExecutor,
    "as_completed": as_completed,
    "resolve_pokemon_card": None,
}
exec(compile(ast.Module(body=[function], type_ignores=[]), source_path, "exec"), namespace)
resolve_cards_parallel = namespace["resolve_cards_parallel"]


def fake_resolver(task):
    set_code, number, quantity = task
    if set_code == "FAIL":
        return None
    return {"cardId": f"{set_code}-{number}", "quantity": quantity}


cards = [
    {"setCode": "SET1", "number": "1", "quantity": 1},
    {"setCode": "FAIL", "number": "X", "quantity": 1},
    {"setCode": "SET2", "number": "2", "quantity": 1},
]

resolved = resolve_cards_parallel(cards, fake_resolver)

assert len(resolved) == len(cards), "resolver results must retain input alignment"
assert resolved[0]["cardId"] == "SET1-1"
assert resolved[1] is None, "failed resolution must retain its position"
assert resolved[2]["cardId"] == "SET2-2"

print("PASS meta-deck resolver preserves indexes across failed cards")
