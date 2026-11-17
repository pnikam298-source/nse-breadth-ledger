from pathlib import Path

source_path = Path("public/manasarora_source.html")
target_path = Path("public/index.html")

content = source_path.read_text(encoding="utf-8")

# 1. Update Title
content = content.replace("<title>The Breadth Ledger</title>", "<title>NSE Breadth Ledger</title>")
content = content.replace("<h1>The Breadth Ledger</h1>", "<h1>NSE Breadth Ledger</h1>")

# 2. Add Methodology and Data Quality navigation links to Masthead
old_mastr = '<div class="tbtns"><div class="secwrap">'
new_mastr = '''<div class="tbtns">
        <a href="methodology.html" class="tbtn" style="text-decoration:none">Methodology</a>
        <a href="data-quality.html" class="tbtn" style="text-decoration:none">Data Quality</a>
        <div class="secwrap">'''
content = content.replace(old_mastr, new_mastr)

# 3. Increase wrap max-width for laptop layout
content = content.replace(".wrap{max-width:980px;margin:0 auto;padding:28px 22px 60px}", ".wrap{max-width:1120px;margin:0 auto;padding:28px 24px 60px}")

# 4. Enhance .sec and .mem styling
old_sec_css = ".sec{display:grid;grid-template-columns:230px 1fr 150px;gap:4px 12px;align-items:center;padding:9px 0;border-bottom:1px dotted var(--rule);font-size:13.5px}"
new_sec_css = ".sec{display:grid;grid-template-columns:250px 1fr 200px;gap:4px 14px;align-items:center;padding:10px 0;border-bottom:1px dotted var(--rule);font-size:13.5px}"
content = content.replace(old_sec_css, new_sec_css)

# 5. Add Expand all stocks button to Where fresh highs cluster
old_cluster_btns = '<button class="dl" id="tvClu" type="button">⬇ TradingView file (.txt)</button> <span id="tvCluMsg"'
new_cluster_btns = '<button class="dl" id="tvClu" type="button">⬇ TradingView file (.txt)</button> <button class="dl" id="toggleAllClu" type="button">▾ Expand all stocks</button> <span id="tvCluMsg"'
content = content.replace(old_cluster_btns, new_cluster_btns)

# 6. Update cluster renderer in render(d) to show percentage breakdown and count
old_cluster_render = """      <div class="div2"><i class="b3" style="width:${sh3}%"></i><i class="b6" style="width:${share}%"></i></div>
      <div class="a" style="text-align:right">${c.h3} of ${c.n} at 3M highs</div>"""
new_cluster_render = """      <div class="div2"><i class="b3" style="width:${sh3}%"></i><i class="b6" style="width:${share}%"></i></div>
      <div class="a" style="text-align:right"><b>${Math.round(share)}% / ${Math.round(sh3)}%</b> · ${c.h3} of ${c.n} at 3M</div>"""
content = content.replace(old_cluster_render, new_cluster_render)

# 7. Update DATA_URL and SNAP_URL
old_urls = """const DATA_URL=location.hostname.endsWith('workers.dev')?'/data.json':'https://breadth-ledger.manas-arora.workers.dev/data.json';
const SNAP_URL=location.hostname.endsWith('workers.dev')?'/data-snapshot.json':'https://breadth-ledger.manas-arora.workers.dev/data-snapshot.json';"""
new_urls = """const DATA_URL='./data/data.json';
const SNAP_URL='./data.json';"""
content = content.replace(old_urls, new_urls)

# 8. Add toggleAllClu click handler
old_sec_click = "$('#sectors').onclick=e=>{"
new_sec_click = """let allExpanded=false;
$('#toggleAllClu').onclick=()=>{
  allExpanded=!allExpanded;
  if(allExpanded){
    (DATA.clusters||[]).forEach(c=>OPEN.add(c.industry));
    $('#toggleAllClu').textContent='▴ Collapse all stocks';
  } else {
    OPEN.clear();
    $('#toggleAllClu').textContent='▾ Expand all stocks';
  }
  render(DATA);
};
$('#sectors').onclick=e=>{"""
content = content.replace(old_sec_click, new_sec_click)

# 9. Remove visitor beacon script at the bottom
beacon_idx = content.find("/* private visit counting")
if beacon_idx != -1:
    script_start = content.rfind("<script>", 0, beacon_idx)
    script_end = content.find("</script>", beacon_idx) + 9
    content = content[:script_start] + content[script_end:]

# 10. Update footer note to mention NSE Breadth Ledger and DPDP Act compliance
old_foot = '<div class="foot">Market-wide counts only, built from prices delayed by about 15 minutes during market hours and final once the day closes. This is market information, not investment advice, and breadth helps judge risk, not direction.</div>'
new_foot = '<div class="foot">Market-wide counts only, built from NSE official bhavcopies. Prices delayed by ~15 minutes during market hours and finalized post-close. This is market information and quantitative breadth analysis, not SEBI-registered investment advice. All position sizing calculators operate client-side only under India\'s DPDP Act.</div>'
content = content.replace(old_foot, new_foot)

target_path.write_text(content, encoding="utf-8")
print(f"Successfully generated {target_path} ({len(content)} bytes)")
