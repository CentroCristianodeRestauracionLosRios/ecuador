"""
fix.py — Ejecutar en la carpeta del proyecto cuando index.html se trunca.
Uso: python fix.py
"""
import os

ENDING = '''      <button class="btn-cancel" onclick="cerrarMoverMedia()">Cancelar</button>
      </div>
    </div>
  </div>

  <script src="script.js" type="module"></script>
</body>
</html>
'''

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

if '</html>' in content:
    print("✅ index.html ya está completo, no se necesita arreglo.")
else:
    # Remove any partial last line that might be cut mid-tag
    # Find last complete closing tag
    last_good = max(
        content.rfind('</div>'),
        content.rfind('</button>'),
        content.rfind('</p>'),
    )
    if last_good > 0:
        content = content[:last_good + content[last_good:].index('>') + 1]
    content += '\n' + ENDING
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ index.html completado correctamente.")
    print(f"   Total líneas: {content.count(chr(10))}")
