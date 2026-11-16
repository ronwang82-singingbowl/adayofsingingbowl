#!/usr/bin/env python3
"""Merge new nodes into a fresh Firebase rules export; never publish or overwrite it."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('current',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
if a.current.resolve()==a.output.resolve() or a.output.exists():p.error('Output must be new; preserve the exported rules backup')
rules=json.loads(a.current.read_text());root=rules['rules']
for k in ['.read','.write']:
    if root.get(k,False) not in [False,'false']:p.error('Root grants access: review before merging private records')
fragment=json.loads((Path(__file__).resolve().parent.parent/'docs/firebase-companion-rules.fragment.json').read_text())
for key,value in fragment.items():
    if key in root and root[key]!=value:p.error(f'{key} already has different rules; review instead of overwriting')
    root[key]=value
a.output.write_text(json.dumps(rules,ensure_ascii=False,indent=2)+'\n')
print('Candidate created; compare with fresh export before publication:',a.output)
