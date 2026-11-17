import re
from pathlib import Path

source_path = Path("public/manasarora_source.html")
target_path = Path("public/index.html")

content = source_path.read_text(encoding="utf-8")

# 1. Update Title and Heading
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

# 5. Styling for .mq a.tvl with percentage badge
old_mq_css = ".mq a.tvl{display:inline-block;margin:2px 6px 2px 0;padding:0 8px;border-radius:3px;background:var(--chip2);color:var(--ink);font-size:12.5px;line-height:1.9}.mq a.tvl:hover{filter:brightness(1.12)}"
new_mq_css = ".mq a.tvl{display:inline-flex;align-items:baseline;margin:2px 6px 2px 0;padding:2px 8px;border-radius:3px;background:var(--chip2);color:var(--ink);font-size:12.5px;line-height:1.9}.mq a.tvl:hover{filter:brightness(1.12)}.mq a.tvl i{font-style:normal;font-size:11px;font-weight:600;opacity:.85;margin-left:5px}"
content = content.replace(old_mq_css, new_mq_css)

# 6. Add Expand all stocks button to Where fresh highs cluster
old_cluster_btns = '<button class="dl" id="tvClu" type="button">⬇ TradingView file (.txt)</button> <span id="tvCluMsg"'
new_cluster_btns = '<button class="dl" id="tvClu" type="button">⬇ TradingView file (.txt)</button> <button class="dl" id="toggleAllClu" type="button">▾ Expand all stocks</button> <span id="tvCluMsg"'
content = content.replace(old_cluster_btns, new_cluster_btns)

# 7. Update cluster renderer in render(d) to show percentage breakdown and count
old_cluster_render = """      <div class="div2"><i class="b3" style="width:${sh3}%"></i><i class="b6" style="width:${share}%"></i></div>
      <div class="a" style="text-align:right">${c.h3} of ${c.n} at 3M highs</div>"""
new_cluster_render = """      <div class="div2"><i class="b3" style="width:${sh3}%"></i><i class="b6" style="width:${share}%"></i></div>
      <div class="a" style="text-align:right"><b>${Math.round(share)}% / ${Math.round(sh3)}%</b> · ${c.h3} of ${c.n} at 3M</div>"""
content = content.replace(old_cluster_render, new_cluster_render)

# 8. Update DATA_URL and SNAP_URL to local generated data.json
old_urls = """const DATA_URL=location.hostname.endsWith('workers.dev')?'/data.json':'https://breadth-ledger.manas-arora.workers.dev/data.json';
const SNAP_URL=location.hostname.endsWith('workers.dev')?'/data-snapshot.json':'https://breadth-ledger.manas-arora.workers.dev/data-snapshot.json';"""
new_urls = """const DATA_URL='./data/data.json';
const SNAP_URL='./data.json';"""
content = content.replace(old_urls, new_urls)

# 9. Add toggleAllClu click handler
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

# 10. Update momoRender to display exact percentage on each stock pill!
old_momo_render = """  const have=pool.filter(st=>score(st)!=null),hit=have.filter(ok).sort((a,b)=>score(b)-score(a)||a[0].localeCompare(b[0]));
  const share=have.length?100*hit.length/have.length:0;
  $('#mOut').innerHTML=`<div class="mres"><b>${hit.length} of ${have.length}</b> ${MI==='__all'?'tracked stocks':'stocks in '+MI} (${f(share)}%) gained at least ${MT}% over the last ${ML} trading days.</div><div class="mbar"><i style="width:${share}%"></i></div><div class="mq">${hit.map(st=>`<a class="tvl" href="${tvUrl(st[0])}" target="_blank" rel="noopener" title="Open ${st[0]} on TradingView">${st[0]}</a>`).join('')||'<span style="background:var(--wash);color:var(--mute)">none meet it</span>'}</div>`;"""

new_momo_render = """  const have=pool.filter(st=>score(st)!=null),hit=have.filter(ok).sort((a,b)=>{
    const pa = a[2] && a[2][li] != null ? a[2][li] : score(a);
    const pb = b[2] && b[2][li] != null ? b[2][li] : score(b);
    return pb - pa || a[0].localeCompare(b[0]);
  });
  const share=have.length?100*hit.length/have.length:0;
  $('#mOut').innerHTML=`<div class="mres"><b>${hit.length} of ${have.length}</b> ${MI==='__all'?'tracked stocks':'stocks in '+MI} (${f(share)}%) gained at least ${MT}% over the last ${ML} trading days.</div><div class="mbar"><i style="width:${share}%"></i></div><div class="mq">${hit.map(st=>{
    const p = st[2] && st[2][li] != null ? st[2][li] : null;
    const pStr = p != null ? (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(1) + '%' : '';
    return `<a class="tvl" href="${tvUrl(st[0])}" target="_blank" rel="noopener" title="${st[0]}: ${pStr} over ${ML} trading days · Open on TradingView">${st[0]}<i>${pStr}</i></a>`;
  }).join('')||'<span style="background:var(--wash);color:var(--mute)">none meet it</span>'}</div>`;"""

content = content.replace(old_momo_render, new_momo_render)

# 11. Update dlMomo CSV download to include exact percentages
old_dl_momo = """$('#dlMomo').onclick=()=>{if(!DATA||!DATA.momo)return;const M=DATA.momo,li=M.lb.indexOf(ML),k=M.th.indexOf(MT)+1;
  const rows=[['Industry','Stock',`Gained at least (%)`,`Over the last (trading days)`]];
  const seen=new Set();(MI==='__all'?M.groups:M.groups.filter(g=>g.industry===MI)).forEach(g=>g.stocks.forEach(([s,m])=>{const c=m[li];if(c!=='-'&&+c>=k&&!seen.has(s)){seen.add(s);rows.push([g.industry,s,MT,ML])}}));
  dlCsv(`breadth-momentum-${MI==='__all'?'all':slug(MI)}-${MT}pct-${ML}d-${stampOf()}.csv`,rows)};"""

new_dl_momo = """$('#dlMomo').onclick=()=>{if(!DATA||!DATA.momo)return;const M=DATA.momo,li=M.lb.indexOf(ML),k=M.th.indexOf(MT)+1;
  const rows=[['Industry','Stock',`Gain (%) over last ${ML} days`,`Gain threshold (%)`,`Lookback (days)`]];
  const seen=new Set();(MI==='__all'?M.groups:M.groups.filter(g=>g.industry===MI)).forEach(g=>g.stocks.forEach(st=>{const [s,m,pcts]=st;const c=m[li];if(c!=='-'&&+c>=k&&!seen.has(s)){seen.add(s);const p=pcts&&pcts[li]!=null?pcts[li]:'';rows.push([g.industry,s,p,MT,ML])}}));
  dlCsv(`breadth-momentum-${MI==='__all'?'all':slug(MI)}-${MT}pct-${ML}d-${stampOf()}.csv`,rows)};"""

content = content.replace(old_dl_momo, new_dl_momo)

# 12. REMOVE ALL MEMBER'S CLUB PROMO BANNERS, FCTA FLOATING POPUP, AND LEAD MODAL
# Remove promo banner divs
content = re.sub(r'<div class="promo[^>]*>.*?</div></div>', '', content, flags=re.DOTALL)
# Remove fcta floating div
content = re.sub(r'<div class="fcta"[^>]*>.*?</div>', '', content, flags=re.DOTALL)
# Remove lead modal div
content = re.sub(r'<div class="lead"[^>]*>.*?</div>\s*</div>', '', content, flags=re.DOTALL)

# Remove offer banner and fcta scripts
content = re.sub(r'<script>\s*/\* offer banner.*?</script>', '', content, flags=re.DOTALL)
content = re.sub(r'<script>\s*\(function\(\)\{const SHOW=Date\.UTC\(2026,10,16.*?</script>', '', content, flags=re.DOTALL)
content = re.sub(r'<script>\s*\(function\(\)\{\s*const FORM="https://docs\.google\.com.*?</script>', '', content, flags=re.DOTALL)

# Remove visitor beacon script
beacon_idx = content.find("/* private visit counting")
if beacon_idx != -1:
    script_start = content.rfind("<script>", 0, beacon_idx)
    script_end = content.find("</script>", beacon_idx) + 9
    content = content[:script_start] + content[script_end:]

# 13. Update footer note to mention NSE Breadth Ledger and DPDP Act compliance
old_foot = '<div class="foot">Market-wide counts only, built from prices delayed by about 15 minutes during market hours and final once the day closes. This is market information, not investment advice, and breadth helps judge risk, not direction.</div>'
new_foot = '<div class="foot">Market-wide counts only, built from NSE official bhavcopies. Prices delayed by ~15 minutes during market hours and finalized post-close. This is market information and quantitative breadth analysis, not SEBI-registered investment advice. All position sizing calculators operate client-side only under India\'s DPDP Act.</div>'
content = content.replace(old_foot, new_foot)

target_path.write_text(content, encoding="utf-8")
print(f"Successfully generated {target_path} ({len(content)} bytes)")
