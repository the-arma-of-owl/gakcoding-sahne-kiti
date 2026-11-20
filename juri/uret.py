# 4 jüri oylama şeması: Excel (jüri sayfaları + Sonuç formülleri) ve yazdırılabilir HTML/PDF.
import pathlib, locale
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
K = pathlib.Path(__file__).parent
T = [("Kuzey Yıldızı","Gastronomi Rotası"),("Mavi Kod","Kilim Motif"),("Bit Avcıları","Vişne"),("Kod Kervanı","Keban Füme"),("Gece Kuşları","Geven Balı"),("Piksel Ustaları","Orcik"),("Sıfır Bir","Çedene"),("Turbo Kaplumbağa","Öküzgözü"),("Kahve ve Kod","Harput"),("Yeni Sürüm","Vişne Mermeri"),("Bulut Dokuz","Ağın Leblebisi"),("Hata Avcıları","Kahvaltı Kutusu"),("Kare Kod","Bakır"),("Son Commit","Hazar"),("Döngü","Pestil")]
O = [("Ürün ve hikâye","Elazığ ürünü anlatılıyor mu?"),("Tasarım","Güzel ve telefonda düzgün mü?"),("Çalışırlık","Link açılıyor, düğmeler çalışıyor mu?"),("Özgünlük","Kopya değil, fikri var mı?")]
wb = Workbook(); kal = Font(bold=True, color="FFFFFF"); dol = PatternFill("solid", fgColor="1F2A44")
in_ = Side(style="thin", color="999999"); ç = Border(left=in_, right=in_, top=in_, bottom=in_)
bas = ["Takım", "Ürün"] + [f"{a} (0-25)" for a, _ in O] + ["Toplam (100)"]
wb.remove(wb.active)
for j in range(1, 5):
    w = wb.create_sheet(f"Jüri {j}"); w.append(bas)
    for i, (t, u) in enumerate(T, 2):
        w.append([t, u, None, None, None, None, f'=IF(COUNT(C{i}:F{i})=0,"",SUM(C{i}:F{i}))'])
    d = DataValidation(type="whole", operator="between", formula1="0", formula2="25", showErrorMessage=True, error="0 ile 25 arası tam sayı")
    w.add_data_validation(d); d.add(f"C2:F{len(T)+1}")
    w.freeze_panes = "C2"
s = wb.create_sheet("Sonuç")
s.append(["Takım", "Ürün", "Jüri 1", "Jüri 2", "Jüri 3", "Jüri 4", "Toplam (400)", "Sıra"])
n = len(T) + 1
for i, (t, u) in enumerate(T, 2):
    s.append([t, u] + [f"=N('Jüri {j}'!G{i})" for j in range(1, 5)] + [f"=SUM(C{i}:F{i})", f"=RANK(G{i},$G$2:$G${n})"])
s.append([]); s.append(["Eşitlikte: önce Çalışırlık toplamı, sonra Ürün ve hikâye toplamı yüksek olan öne geçer."])
for w in wb:
    for c in w[1]:
        c.font = kal; c.fill = dol; c.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    for r in w.iter_rows(min_row=1, max_row=n):
        for c in r: c.border = ç
    w.column_dimensions["A"].width = 24; w.column_dimensions["B"].width = 20
    for k in "CDEFGH": w.column_dimensions[k].width = 14
    w.row_dimensions[1].height = 42
wb.save(K / "GakCoding-juri-oylama.xlsx")
sat = "".join(f"<tr><td>{t}</td><td>{u}</td>" + "<td></td>" * 5 + "</tr>" for t, u in T)
ol = "".join(f"<li><b>{a}:</b> {b}</li>" for a, b in O)
sf = "".join(f"""<section><h1>GakCoding 2026 · Jüri {j}</h1><p>Ad Soyad: ____________________ &nbsp; İmza: ______________</p><ol>{ol}</ol>
<table><thead><tr><th>Takım</th><th>Ürün</th>{''.join(f'<th>{a}<br>0-25</th>' for a,_ in O)}<th>Toplam<br>100</th></tr></thead><tbody>{sat}</tbody></table>
<p class="k">Siteye girerken toplamı 10'a bölüp yuvarlayın (örnek 83 → 8). Eşitlikte önce Çalışırlık, sonra Ürün ve hikâye bakılır.</p></section>""" for j in range(1, 5))
(K / "juri.html").write_text(f"""<!doctype html><meta charset=utf-8><title>Jüri oylama</title><style>@page{{size:A4 landscape;margin:12mm}}body{{font-family:'DejaVu Sans',sans-serif;font-size:10pt}}section{{page-break-after:always}}section:last-child{{page-break-after:auto}}h1{{font-size:18pt;margin:0 0 6pt}}ol{{columns:2;margin:6pt 0}}table{{width:100%;border-collapse:collapse}}th,td{{border:1px solid #444;padding:4pt 5pt;text-align:left}}th{{background:#eee;font-size:9pt}}.k{{font-size:9pt;color:#333}}</style>{sf}""")
