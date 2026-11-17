"""
Unit tests for Bhavcopy Parsers (UDiFF, Legacy CM, SecBhav).
"""
import io
import zipfile
import pytest
import pandas as pd
from pipeline.parsers import UDiFFParser, LegacyCMParser, detect_and_parse

def test_udiff_parser():
    udiff_content = (
        "TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,OpnPric,HghPric,LwPric,ClsPric,PrvsClsgPric,TtlTradgVol,TtlTrfVal\n"
        "2026-11-17,2026-11-17,CM,NSE,STK,1234,INE002A01018,RELIANCE,EQ,1339.00,1374.00,1335.00,1367.00,1344.80,15905595,2160000000.00\n"
        "2026-11-17,2026-11-17,CM,NSE,STK,5678,INE467B01029,TCS,EQ,2395.00,2420.00,2385.00,2406.60,2405.00,3027101,728000000.00\n"
    ).encode("utf-8")

    parser = UDiFFParser()
    df = parser.parse(udiff_content)

    assert len(df) == 2
    assert list(df["symbol"]) == ["RELIANCE", "TCS"]
    assert list(df["series"]) == ["EQ", "EQ"]
    assert df.loc[0, "close"] == 1367.00
    assert df.loc[0, "prev_close"] == 1344.80
    assert df.loc[0, "volume"] == 15905595
    assert df.loc[0, "date"] == "2026-11-17"

def test_legacy_cm_parser():
    legacy_content = (
        "SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN\n"
        "INFY,EQ,1450.00,1480.00,1440.00,1475.00,1475.00,1445.00,5000000,7350000000.00,10-MAY-2024,150000,INE009A01021\n"
    ).encode("utf-8")

    # Wrap in zip to test zip handling
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("cm10MAY2024bhav.csv", legacy_content)
    zip_bytes = buf.getvalue()

    parser = LegacyCMParser()
    df = parser.parse(zip_bytes)

    assert len(df) == 1
    assert df.loc[0, "symbol"] == "INFY"
    assert df.loc[0, "date"] == "2024-05-10"
    assert df.loc[0, "close"] == 1475.00
    assert df.loc[0, "prev_close"] == 1445.00

def test_detect_and_parse_auto():
    udiff_csv = (
        "TradDt,TckrSymb,SctySrs,OpnPric,HghPric,LwPric,ClsPric,PrvsClsgPric,TtlTradgVol,TtlTrfVal,ISIN\n"
        "2026-11-17,HDFCBANK,EQ,1750.0,1765.0,1740.0,1760.0,1745.0,1000000,1750000000.0,INE040A01034\n"
    ).encode("utf-8")

    df = detect_and_parse(udiff_csv)
    assert len(df) == 1
    assert df.loc[0, "symbol"] == "HDFCBANK"
    assert df.loc[0, "close"] == 1760.0
