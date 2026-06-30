"""NEXUS product taxonomy — single source of truth for the cross-sell catalog.

Mirrors server/services/productCatalog.js (the demo side). See
NEXUS_IMPLEMENTATION.md §2. Used by the PKDD'99 loader, the baseline trainer,
and (later) the GNN trainer.

Honest note on PKDD'99 coverage: only 4 of these products have REAL ground
truth in the Berka dataset:
    CREDIT_CARD_BASIC   (card.type in junior/classic)
    CREDIT_CARD_PREMIUM (card.type == gold)
    PERSONAL_LOAN       (loan.csv)
    LIFE_INSURANCE      (order.k_symbol == POJISTNE)
    CAR_LOAN            (order.k_symbol == LEASING)   [proxy — leasing payments]
The remaining products have no Berka label and must NOT be reported as trained
signal; they are trainable only via the Santander extension or labelled-synthetic
holdouts. `PKDD99_TRAINABLE` lists the products we actually train on.
"""

from __future__ import annotations

PRODUCT_CATALOG: list[str] = [
    "CREDIT_CARD_BASIC",
    "CREDIT_CARD_PREMIUM",
    "PERSONAL_LOAN",
    "HOME_LOAN",
    "CAR_LOAN",
    "FIXED_DEPOSIT",
    "RECURRING_DEPOSIT",
    "DEMAT_ACCOUNT",
    "LIFE_INSURANCE",
    "HEALTH_INSURANCE",
]
PRODUCT_TO_IDX = {p: i for i, p in enumerate(PRODUCT_CATALOG)}
N_PRODUCTS = len(PRODUCT_CATALOG)

# Products with genuine ground truth in PKDD'99 / Berka (the only ones we train).
PKDD99_TRAINABLE: list[str] = [
    "CREDIT_CARD_BASIC",
    "CREDIT_CARD_PREMIUM",
    "PERSONAL_LOAN",
    "CAR_LOAN",
    "LIFE_INSURANCE",
]

# Static per-product features (§4.2): [is_credit, is_secured, typical_tenure_months, risk_tier]
PRODUCT_FEATURES: dict[str, list[float]] = {
    "CREDIT_CARD_BASIC":   [1, 0, 36, 2],
    "CREDIT_CARD_PREMIUM": [1, 0, 36, 2],
    "PERSONAL_LOAN":       [1, 0, 36, 3],
    "HOME_LOAN":           [1, 1, 240, 1],
    "CAR_LOAN":            [1, 1, 60, 2],
    "FIXED_DEPOSIT":       [0, 0, 12, 0],
    "RECURRING_DEPOSIT":   [0, 0, 24, 0],
    "DEMAT_ACCOUNT":       [0, 0, 0, 0],
    "LIFE_INSURANCE":      [0, 0, 120, 0],
    "HEALTH_INSURANCE":    [0, 0, 12, 0],
}
