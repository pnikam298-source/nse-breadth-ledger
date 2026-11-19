"""
Tests for 1000-stock manas_generator output and schema integrity.
"""
import json
from pathlib import Path
import pytest
from pipeline.config import PUBLIC_DATA_DIR

def test_data_json_structure():
    data_file = PUBLIC_DATA_DIR / "data.json"
    assert data_file.exists(), "public/data/data.json must exist"
    
    with open(data_file) as f:
        data = json.load(f)
        
    # Check top-level required fields
    required_keys = [
        "asOf", "final", "shut", "universe", "today", 
        "nifty", "indexChg", "recentDays", "series", 
        "momo", "near", "clusters", "rs"
    ]
    for k in required_keys:
        assert k in data, f"Key {k} missing in data.json"
        
    assert data["universe"] >= 900, f"Expected >= 900 active stocks, got {data['universe']}"
    assert len(data["series"]) >= 400, f"Expected >= 400 sessions, got {len(data['series'])}"
    assert len(data["clusters"]) >= 30, f"Expected >= 30 sub-industry clusters, got {len(data['clusters'])}"
    assert len(data["near"]) >= 900, f"Expected >= 900 near stocks, got {len(data['near'])}"
    
    # Test RS rating screener
    rs = data["rs"]
    assert "asOf" in rs
    assert "n" in rs
    assert "tot" in rs
    assert "rows" in rs
    assert rs["n"] >= 800, f"Expected >= 800 rated stocks, got {rs['n']}"
    assert len(rs["rows"]) == rs["n"]
    
    # Check rating range (1 to 99)
    ratings = [r[1] for r in rs["rows"]]
    assert min(ratings) == 1, f"Expected min RS 1, got {min(ratings)}"
    assert max(ratings) == 99, f"Expected max RS 99, got {max(ratings)}"
    # Rows must be sorted descending by rating
    assert ratings == sorted(ratings, reverse=True), "RS rows must be sorted descending by rating"
    
    # First row format: [symbol, rating, industry]
    first_row = rs["rows"][0]
    assert isinstance(first_row[0], str)
    assert isinstance(first_row[1], int)
    assert isinstance(first_row[2], str)
    
    # Test cluster pills
    cluster = data["clusters"][0]
    assert "industry" in cluster
    assert "n" in cluster
    assert "all" in cluster
    assert len(cluster["all"]) > 0
    # Each item in cluster['all'] is [symbol, level]
    sym, lvl = cluster["all"][0]
    assert isinstance(sym, str)
    assert lvl in [0, 1, 2, 3]
    
    # Test recentDays
    assert len(data["recentDays"]) >= 5
    assert data["recentDays"][0]["date"] == "live"
    assert "h1m" in data["recentDays"][1]

    # Test Sector Rotation
    assert "rotation" in data, "rotation key missing in data.json"
    assert len(data["rotation"]) >= 30, f"Expected >= 30 sectors, got {len(data['rotation'])}"
    sec = data["rotation"][0]
    assert "industry" in sec and "quadrant" in sec and "avg_rs" in sec
    assert sec["quadrant"] in ["Leading", "Weakening", "Lagging", "Improving"]

    # Test Institutional Volume Surge Screener
    assert "volume_surge" in data, "volume_surge key missing in data.json"
    assert len(data["volume_surge"]) >= 10, f"Expected >= 10 volume surge stocks, got {len(data['volume_surge'])}"
    stp = data["volume_surge"][0]
    assert "symbol" in stp and "close" in stp and "pct_chg_1d" in stp and "rvol_1d" in stp and "vol_30d" in stp
    assert stp["rvol_1d"] >= 1.0
    assert stp["pct_chg_1d"] >= 1.0
