import os
import re

directories = [
    r"c:\Users\Axioo\OneDrive\Documents\Tugas Akhir\Project_TA\frontend\src\app\admin",
    r"c:\Users\Axioo\OneDrive\Documents\Tugas Akhir\Project_TA\frontend\src\components\admin",
    r"c:\Users\Axioo\OneDrive\Documents\Tugas Akhir\Project_TA\frontend\src\components\SystemHealthCard.tsx"
]

pattern = re.compile(r"(['\"])http://127\.0\.0\.1:8000(.*?)(\1)")
pattern_template = re.compile(r"`http://127\.0\.0\.1:8000(.*?)`")

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    # Handle single or double quotes
    content = pattern.sub(r"`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}\2`", content)
    # Handle template literals
    content = pattern_template.sub(r"`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}\1`", content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for d in directories:
    if os.path.isfile(d):
        process_file(d)
    else:
        for root, _, files in os.walk(d):
            for file in files:
                if file.endswith('.tsx') or file.endswith('.ts'):
                    process_file(os.path.join(root, file))

print("Selesai memperbaiki semua file!")
