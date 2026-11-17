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
        "momo", "near", "clusters"
    ]
    for k in required_keys:
        assert k in data, f"Key {k} missing in data.json"
        
    assert data["universe"] >= 900, f"Expected >= 900 active stocks, got {data['universe']}"
    assert len(data["series"]) >= 400, f"Expected >= 400 sessions, got {len(data['series'])}"
    assert len(data["clusters"]) >= 30, f"Expected >= 30 sub-industry clusters, got {len(data['clusters'])}"
    assert len(data["near"]) >= 900, f"Expected >= 900 near stocks, got {len(data['near'])}"
    
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
