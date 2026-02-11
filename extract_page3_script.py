# -*- coding: utf-8 -*-
import os
base = os.path.dirname(os.path.abspath(__file__))
html_path = os.path.join(base, 'page3.html')
js_path = os.path.join(base, 'page3.js')
with open(html_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
# lines 495-2052 (0-based: 494-2051)
slice_lines = lines[494:2052]
def unindent(line):
    s = line.rstrip('\r\n')
    if len(s) >= 8 and s.startswith('        '):
        return s[8:]
    return s
out = '\n'.join(unindent(l) for l in slice_lines)
with open(js_path, 'w', encoding='utf-8') as f:
    f.write(out)
print('Written', js_path)
