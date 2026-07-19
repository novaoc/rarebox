#!/usr/bin/env python3
import importlib.util
from pathlib import Path

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("pc_grades", root / "api" / "pricecharting_grades.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

html = """<table><tr><td>Grade 9</td><td>Grade 9.5</td></tr></table>
<div id="full-prices"><table>
<tr><td>Grade 8</td><td class="price">$800.00</td></tr>
<tr><td>Grade 9.5</td><td class="price">$4,400.00</td></tr>
<tr><td>CGC 10</td><td class="price">$4,300.00</td></tr>
<tr><td>PSA 10</td><td class="price">$6,060.50</td></tr>
<tr><td>BGS 10 Black</td><td class="price">$39,395.00</td></tr>
</table></div>"""
prices = module.parse_grade_prices(html)
assert prices["grade8"] == 800
assert prices["grade9_5"] == 4400
assert "grade9" not in prices
assert prices["cgc10"] == 4300
assert prices["psa10"] == 6060.5
assert prices["bgs10_black"] == 39395
print("PASS PriceCharting full grade HTML parser")
