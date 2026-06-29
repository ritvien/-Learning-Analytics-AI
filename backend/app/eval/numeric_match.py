"""Shared numeric comparison helpers for eval scorers."""

from __future__ import annotations


def expand_number_variants(value: float) -> set[float]:
    """Return equivalent numeric forms (e.g. rate 0.5321 <-> 53.21 percent)."""
    variants: set[float] = {value, round(value, 6)}
    if 0 < abs(value) <= 1.0:
        variants.add(value * 100)
        variants.add(round(value * 100, 4))
    if 1.0 < abs(value) <= 100.0:
        variants.add(value / 100)
        variants.add(round(value / 100, 6))
    return variants


def values_match(expected: float, actual: float, tolerance: float) -> bool:
    """True when expected and actual match within tolerance, including % scale."""
    if tolerance <= 0:
        tolerance = 0.001
    for exp in expand_number_variants(expected):
        for act in expand_number_variants(actual):
            if exp == 0:
                if abs(act) <= tolerance:
                    return True
            elif abs(exp - act) / abs(exp) <= tolerance:
                return True
            elif abs(exp - act) <= tolerance:
                return True
    return False
