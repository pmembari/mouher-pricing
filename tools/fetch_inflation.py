#!/usr/bin/env python3
"""Build a cited, explicitly annual Iran inflation reference. Never invent monthly CPI."""
import json, datetime, urllib.request, pathlib
out = pathlib.Path("inflation-data.json")
source = "https://api.worldbank.org/v2/country/IRN/indicator/FP.CPI.TOTL.ZG?format=json&per_page=60"
payload = {"status":"unavailable","frequency":"annual","indicator":"Consumer price inflation, annual (%)","provider":"World Bank / IMF International Financial Statistics","source":source,"checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"observations":[],"warning":"Annual national CPI is not monthly garment-manufacturing inflation."}
try:
    req = urllib.request.Request(source,headers={"User-Agent":"MouherPricing/1.0 (educational pricing reference)","Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=20) as resp:
        obj=json.load(resp)
    rows=obj[1] if isinstance(obj,list) and len(obj)>1 and isinstance(obj[1],list) else []
    values=[{"year":int(x["date"]),"annual_pct":round(float(x["value"]),3)} for x in rows if x.get("value") is not None and str(x.get("date","")).isdigit() and -99<float(x["value"])<10000]
    values=sorted(values,key=lambda x:x["year"])
    if values:
        payload["status"]="ok"
        payload["observations"]=values[-8:]
        payload["latest"]=values[-1]
except Exception as exc:
    print("Inflation fetch unavailable:",type(exc).__name__,str(exc)[:160])
out.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Inflation data:",payload["status"],payload.get("latest"))
