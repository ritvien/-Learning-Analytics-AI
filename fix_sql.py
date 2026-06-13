import re

with open('backend/db/init-data.sql', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"(,\s*(?:\d+\.\d+|NULL),\s*')([A-D][+]?|F)\s+[^']+('\s*,\s*'completed'\))", r"\1\2\3", content)

with open('backend/db/init-data.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed init-data.sql')
