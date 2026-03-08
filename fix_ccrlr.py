"""
fix_ccrlr.py
Aplica todos los fixes al proyecto CCRLR.
Modifica directamente los archivos en la carpeta del proyecto.
Ejecutar desde: C:\\Users\\javie\\Documents\\mi pagina web
"""
import os, sys, shutil
from pathlib import Path

BASE = Path(__file__).parent
print(f"📁 Carpeta del proyecto: {BASE}\n")

def leer(nombre):
    path = BASE / nombre
    if not path.exists():
        print(f"❌ No se encontró: {nombre}")
        sys.exit(1)
    return path.read_text(encoding='utf-8')

def guardar(nombre, contenido):
    (BASE / nombre).write_text(contenido, encoding='utf-8')
    print(f"✅ {nombre} guardado")

def reemplazar(contenido, viejo, nuevo, nombre_fix):
    if viejo in contenido:
        print(f"  ✅ {nombre_fix}")
        return contenido.replace(viejo, nuevo, 1)
    else:
        print(f"  ⚠️  Ya aplicado o no encontrado: {nombre_fix}")
        return contenido

# ══════════════════════════════════════════════════════════
print("── index.html ──────────────────────────────────────")
idx = leer('index.html')

# 1) Script del head
idx = reemplazar(idx,
    '  <!-- Fallback: oculta el loader aunque el módulo JS falle -->\n  <script>\n    setTimeout(function() {\n      var el = document.getElementById(\'loaderScreen\');\n      if (el) { el.style.display = \'none\'; }\n    }, 3500);\n  </script>',
    '''  <!-- Fix: loader + bfcache + cola de llamadas tempranas al navbar -->
  <script>
    // Ocultar loader si script.js tarda o falla
    setTimeout(function() {
      var el = document.getElementById('loaderScreen');
      if (el) { el.style.display = 'none'; }
    }, 3500);

    // Fix bfcache: al volver con Atrás desde juego.html, los módulos ES6
    // no se re-ejecutan. Forzar recarga limpia.
    window.addEventListener('pageshow', function(e) {
      if (e.persisted) { window.location.reload(); }
    });

    // Cola para llamadas que lleguen antes de que script.js cargue.
    window._navQueue = [];
    window._navReady = false;

    window._call = function(name, args) {
      if (window._navReady && typeof window[name] === 'function') {
        window[name].apply(null, args || []);
      } else {
        window._navQueue.push({ name: name, args: args || [] });
      }
    };

    window._flush = function() {
      window._navReady = true;
      window._navQueue.forEach(function(item) {
        if (typeof window[item.name] === 'function') {
          window[item.name].apply(null, item.args);
        }
      });
      window._navQueue = [];
    };
  </script>''',
    'HEAD: loader + bfcache + cola _call/_flush'
)

# 2) Separar Juegos y Punto de Encuentro en <li> separados
idx = reemplazar(idx,
    '''      <li>
        <a href="juego.html" class="nav-icon-link" title="Juegos">
          <span>Juegos</span>
          <img src="ICONO.png" class="nav-icon" alt="Juegos" style="filter:hue-rotate(200deg) brightness(1.2)"/>
        </a>
        <a href="#" class="nav-icon-link" onclick="abrirChat(event)" title="Punto de Encuentro">
          <span>Punto de Encuentro</span>
          <img src="CHAT.png" class="nav-icon" alt="Chat"/>
        </a>
      </li>''',
    '''      <li>
        <a href="juego.html" class="nav-icon-link" title="Juegos">
          <span>Juegos</span>
          <img src="juegos.png" class="nav-icon nav-icon-juegos" alt="Juegos"/>
        </a>
      </li>
      <li>
        <a href="javascript:void(0)" class="nav-icon-link" onclick="_call('abrirChat',[event])" title="Punto de Encuentro">
          <span>Punto de Encuentro</span>
          <img src="CHAT.png" class="nav-icon" alt="Chat"/>
        </a>
      </li>''',
    'NAV: Juegos y Punto de Encuentro separados'
)

# 3) Reemplazar onclick críticos con _call
onclick_fixes = [
    ('onclick="toggleNavMenu()"',    "_call('toggleNavMenu')",    'hamburguesa'),
    ('onclick="togglePanelYo()"',    "_call('togglePanelYo')",    'botón Yo'),
    ('onclick="cerrarPanelYo()"',    "_call('cerrarPanelYo')",    'cerrar Yo'),
    ('onclick="toggleTema()"',       "_call('toggleTema')",       'tema'),
    ('onclick="toggleUserMenu()"',   "_call('toggleUserMenu')",   'user menu'),
    ('onclick="toggleLoginPanel()"', "_call('toggleLoginPanel')", 'login panel'),
    ('onclick="adminLogin()"',       "_call('adminLogin')",       'admin login'),
    ('onclick="adminLogout()"',      "_call('adminLogout')",      'admin logout'),
    ('onclick="chatUserLogout()"',   "_call('chatUserLogout')",   'chat logout'),
]

for viejo_val, nuevo_val, nombre in onclick_fixes:
    viejo = f'onclick="{viejo_val}"'
    nuevo = f"onclick=\"{nuevo_val}\""
    # Manejar el caso donde el valor ya tiene comillas simples
    viejo2 = f"onclick=\"{viejo_val}\""
    count = idx.count(viejo)
    if count > 0:
        idx = idx.replace(viejo, nuevo)
        print(f"  ✅ onclick {nombre} ({count}x)")
    else:
        print(f"  ⚠️  ya aplicado: {nombre}")

guardar('index.html', idx)

# ══════════════════════════════════════════════════════════
print("\n── script.js ───────────────────────────────────────")
js = leer('script.js')

flush_line = "\n// Activar cola de llamadas tempranas al navbar\nwindow._flush && window._flush();\n"

if 'window._flush && window._flush()' not in js:
    js = js.rstrip() + flush_line
    print("  ✅ _flush() al final del módulo")
else:
    print("  ⚠️  _flush ya presente")

guardar('script.js', js)

# ══════════════════════════════════════════════════════════
print("\n── styles.css ──────────────────────────────────────")
css = leer('styles.css')

css = reemplazar(css,
    ".nav-icon-link:hover .nav-icon { opacity: 1; }\n.nav-icon-link:hover span { color: var(--accent); }",
    """.nav-icon-link:hover .nav-icon { opacity: 1; }
.nav-icon-link:hover span { color: var(--accent); }

/* Ícono Juegos: blanco como los demás, 40px */
.nav-icon.nav-icon-juegos {
  width: 40px;
  height: 40px;
  filter: brightness(0) invert(1);
  opacity: 0.7;
}
.nav-icon-link:hover .nav-icon.nav-icon-juegos { opacity: 1; }
body.tema-claro .nav-icon.nav-icon-juegos { filter: none; opacity: 0.75; }
body.tema-claro .nav-icon-link:hover .nav-icon.nav-icon-juegos { filter: none; opacity: 1; }""",
    'nav-icon-juegos 40px blanco'
)

guardar('styles.css', css)

# ══════════════════════════════════════════════════════════
print("\n── juegos.png ──────────────────────────────────────")
juego_src = BASE / 'juego.png'
juegos_dst = BASE / 'juegos.png'

if not juego_src.exists():
    print("  ⚠️  juego.png no encontrado, omitiendo")
else:
    try:
        from PIL import Image
        import numpy as np
        img = Image.open(juego_src).convert('RGBA')
        data = np.array(img, dtype=np.float32)
        r, g, b = data[...,0], data[...,1], data[...,2]
        is_bg = (r < 25) & (g < 25) & (b < 25)
        out = data.copy()
        out[is_bg,  3] = 0
        out[~is_bg, 0] = 255
        out[~is_bg, 1] = 255
        out[~is_bg, 2] = 255
        out[~is_bg, 3] = 255
        Image.fromarray(out.astype(np.uint8), 'RGBA').save(juegos_dst)
        print("  ✅ juegos.png generado (blanco, fondo transparente)")
    except ImportError:
        print("  ⚠️  Pillow no disponible, copia juegos.png manualmente")

# ══════════════════════════════════════════════════════════
print("\n══════════════════════════════════════════════════")
print("🎉 FIXES APLICADOS — ahora ejecuta git push")
print("══════════════════════════════════════════════════\n")
