"""pkdd99_loader.py — load the Berka / PKDD'99 dataset into a NEXUS training frame.

Joins the 8 Berka tables into ONE row per account-owning client, with:
  - real product holdings (multi-hot over PKDD99_TRAINABLE)
  - engineered customer features (demographics + account + transaction RFM)

Berka specifics handled here:
  - All CSVs are ';'-delimited and quoted.
  - We keep OWNER dispositions only (DISPONENT = secondary user, not the holder).
  - birth_number encodes DOB + gender: YYMMDD, and for women MM has +50 added.
  - district.csv is header-less coded columns A1..A16 (A11=avg salary, A13=unemployment'96).
  - Product mapping:
        CREDIT_CARD_BASIC   = card.type in {junior, classic}
        CREDIT_CARD_PREMIUM = card.type == gold
        PERSONAL_LOAN       = any loan on the account
        CAR_LOAN            = order.k_symbol == LEASING   (proxy)
        LIFE_INSURANCE      = order.k_symbol == POJISTNE

See NEXUS_IMPLEMENTATION.md §3.1. Honest caveat: only these 5 products have real
Berka labels — do not claim trained signal for the others.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from ml.features.product_taxonomy import PKDD99_TRAINABLE

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
PKDD_DIR = ROOT / "data" / "datasets" / "pkdd99"

# Reference date for tenure/recency (dataset ends in 1998-12; use 1999-01-01).
REF_DATE = pd.Timestamp("1999-01-01")

FEATURE_NAMES = [
    "age",
    "is_female",
    "account_tenure_days",
    "n_accounts_owned",
    "district_avg_salary",
    "district_unemployment",
    "n_transactions",
    "avg_txn_amount",
    "total_txn_amount",
    "last_balance",
    "credit_txn_ratio",
    "freq_monthly",
    "freq_weekly",
]


def _read(name: str, **kw) -> pd.DataFrame:
    return pd.read_csv(PKDD_DIR / name, sep=";", **kw)


def _parse_birth(birth_number: int) -> tuple[int, int]:
    """Return (age_years, is_female) from a Berka birth_number (YYMMDD, +50 mm if female)."""
    s = f"{int(birth_number):06d}"
    yy, mm, dd = int(s[:2]), int(s[2:4]), int(s[4:6])
    is_female = 1 if mm > 50 else 0
    if mm > 50:
        mm -= 50
    year = 1900 + yy  # all Berka clients born 1900s
    try:
        dob = pd.Timestamp(year=year, month=max(mm, 1), day=max(min(dd, 28), 1))
        age = int((REF_DATE - dob).days // 365)
    except Exception:
        age = 40
    return age, is_female


def _parse_date_yymmdd(series: pd.Series) -> pd.Series:
    """Berka dates are YYMMDD integers (1900s)."""
    s = series.astype(int).astype(str).str.zfill(6)
    return pd.to_datetime("19" + s, format="%Y%m%d", errors="coerce")


def load_pkdd99() -> pd.DataFrame:
    """Build the per-client NEXUS training frame. Returns a DataFrame with
    FEATURE_NAMES columns + one 0/1 column per product in PKDD99_TRAINABLE
    + identifier columns (client_id, district_id)."""
    if not (PKDD_DIR / "client.csv").exists():
        raise FileNotFoundError(
            f"PKDD'99 CSVs not found in {PKDD_DIR}. "
            "Download 'marceloventura/the-berka-dataset' and unzip there."
        )

    client   = _read("client.csv")
    disp     = _read("disp.csv")
    account  = _read("account.csv")
    card     = _read("card.csv")
    loan     = _read("loan.csv")
    order    = _read("order.csv")
    district = _read("district.csv")   # header row is coded A1..A16 (Berka convention)

    # ── Owners only: client ↔ account via disposition ────────────────────────
    owners = disp[disp["type"] == "OWNER"].copy()
    base = owners.merge(client, on="client_id", how="left") \
                 .merge(account, on="account_id", how="left", suffixes=("", "_acc"))

    # ── Demographics ─────────────────────────────────────────────────────────
    ages = base["birth_number"].apply(_parse_birth)
    base["age"]       = ages.apply(lambda t: t[0])
    base["is_female"] = ages.apply(lambda t: t[1])

    # ── Account tenure + statement frequency ─────────────────────────────────
    base["acct_open"] = _parse_date_yymmdd(base["date"])
    base["account_tenure_days"] = (REF_DATE - base["acct_open"]).dt.days.clip(lower=0).fillna(0)
    base["freq_monthly"] = (base["frequency"] == "POPLATEK MESICNE").astype(int)
    base["freq_weekly"]  = (base["frequency"] == "POPLATEK TYDNE").astype(int)

    # ── District economics (A1=id, A11=avg salary, A13=unemployment'96) ──────
    dist = district[["A1", "A11", "A13"]].copy()
    dist.columns = ["district_id", "district_avg_salary", "district_unemployment"]
    dist["district_avg_salary"]   = pd.to_numeric(dist["district_avg_salary"], errors="coerce")
    dist["district_unemployment"] = pd.to_numeric(dist["district_unemployment"], errors="coerce")
    base = base.merge(dist, on="district_id", how="left")

    # ── Transaction RFM (per account) — read only needed cols (trans is 69MB) ─
    trans = _read("trans.csv", usecols=["account_id", "type", "amount", "balance"])
    g = trans.groupby("account_id")
    txn = pd.DataFrame({
        "n_transactions":   g.size(),
        "avg_txn_amount":   g["amount"].mean(),
        "total_txn_amount": g["amount"].sum(),
        "last_balance":     g["balance"].last(),
        "credit_txn_ratio": g["type"].apply(lambda s: (s == "PRIJEM").mean()),  # PRIJEM = credit
    }).reset_index()
    base = base.merge(txn, on="account_id", how="left")

    # ── n_accounts_owned per client ──────────────────────────────────────────
    base["n_accounts_owned"] = base.groupby("client_id")["account_id"].transform("count")

    # ── Product holdings ─────────────────────────────────────────────────────
    # Card tier → via disp_id
    card_join = card.merge(owners[["disp_id", "account_id"]], on="disp_id", how="inner")
    basic_accts   = set(card_join.loc[card_join["type"].isin(["junior", "classic"]), "account_id"])
    premium_accts = set(card_join.loc[card_join["type"] == "gold", "account_id"])
    loan_accts    = set(loan["account_id"])
    leasing_accts = set(order.loc[order["k_symbol"] == "LEASING", "account_id"])
    insur_accts   = set(order.loc[order["k_symbol"] == "POJISTNE", "account_id"])

    base["CREDIT_CARD_BASIC"]   = base["account_id"].isin(basic_accts).astype(int)
    base["CREDIT_CARD_PREMIUM"] = base["account_id"].isin(premium_accts).astype(int)
    base["PERSONAL_LOAN"]       = base["account_id"].isin(loan_accts).astype(int)
    base["CAR_LOAN"]            = base["account_id"].isin(leasing_accts).astype(int)
    base["LIFE_INSURANCE"]      = base["account_id"].isin(insur_accts).astype(int)

    # ── Assemble + clean ─────────────────────────────────────────────────────
    cols = ["client_id", "district_id"] + FEATURE_NAMES + PKDD99_TRAINABLE
    df = base[cols].copy()
    for c in FEATURE_NAMES:
        df[c] = pd.to_numeric(df[c], errors="coerce")
        df[c] = df[c].fillna(df[c].median())

    df = df.drop_duplicates(subset=["client_id"]).reset_index(drop=True)
    logger.info("PKDD'99 loaded: %d clients, %d features", len(df), len(FEATURE_NAMES))
    return df


def holdings_summary(df: pd.DataFrame) -> dict:
    """Adoption counts per trainable product (for sanity logging)."""
    return {p: int(df[p].sum()) for p in PKDD99_TRAINABLE}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    frame = load_pkdd99()
    print(f"\nLoaded {len(frame)} clients × {len(FEATURE_NAMES)} features")
    print("\nProduct adoption (real Berka labels):")
    for p, n in holdings_summary(frame).items():
        print(f"  {p:20s} {n:4d}  ({n / len(frame) * 100:.1f}%)")
    print("\nFeature sample (first 3 clients):")
    print(frame[["client_id", "age", "is_female", "account_tenure_days",
                 "n_transactions", "avg_txn_amount", "last_balance"]].head(3).to_string(index=False))
