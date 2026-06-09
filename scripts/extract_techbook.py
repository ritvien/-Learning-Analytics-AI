import re

with open(r'c:\Users\Admin\AI in Action\Project\C2-App-056\docs\10-References\Techbook', 'r', encoding='utf-8') as f:
    text = f.read()

# Strip all HTML tags
clean = re.sub(r'<[^>]+>', '\n', text)

with open(r'c:\Users\Admin\AI in Action\Project\C2-App-056\docs\10-References\techbook_raw.txt', 'w', encoding='utf-8') as f:
    f.write(clean)
