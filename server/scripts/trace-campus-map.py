# Traces the campus map (pixel coordinates from the reference image) into
#   server/data/campus.json         buildings + rooms (3 floors x 5 rooms)
#   client/src/config/siteplan.js   roads, grounds, gardens, landmarks for the 3D view
import json, sys
ROOT = sys.argv[1]
S = 0.3                      # metres per map pixel
CX, CY = 379, 425            # map centre in pixels -> world origin
def X(px): return round((px - CX) * S, 2)
def Z(py): return round((py - CY) * S, 2)

# id, name, kind, x0, y0, x1, y1 (pixels)
B = [
  ('DTH',    'Design Thinking Huddle',     'classroom', 33, 105, 123, 172),
  ('MECH',   'Mechanical Dept',            'classroom', 33, 172, 123, 265),
  ('BIO',    'Biotech Quadrangle',         'classroom', 33, 305, 123, 432),
  ('GH',     'Green House',                'classroom', 33, 437, 123, 482),
  ('ADMIN',  'Admin Block',                'classroom', 172, 157, 350, 262),
  ('IEM',    'IEM Auditorium',             'classroom', 172, 305, 235, 345),
  ('KRIYA',  'Kriyakalpa',                 'classroom', 290, 305, 373, 345),
  ('RVU',    'RV University',              'classroom', 233, 357, 293, 437),
  ('TAC',    'Thoda Aur Canteen',          'canteen',   293, 385, 323, 437),
  ('BANK',   'Kotak Mahindra Bank',        'classroom', 462, 125, 523, 183),
  ('CIVIL',  'Civil Dept',                 'classroom', 415, 183, 523, 265),
  ('EEE',    'EEE Dept',                   'classroom', 415, 305, 523, 383),
  ('ECE',    'ECE Dept',                   'classroom', 323, 383, 523, 437),
  ('PE',     'PE & Sports Dept',           'classroom', 597, 293, 725, 325),
  ('CSE',    'CSE Dept',                   'classroom', 555, 343, 725, 380),
  ('HC',     'Health Centre',              'classroom', 555, 380, 725, 410),
  ('KH',     'Krishna Hostel',             'classroom', 555, 445, 725, 490),
  ('CBH',    'Cauvery Boys Hostel',        'classroom', 615, 540, 725, 638),
  ('MATH',   'Mathematics Dept',           'classroom', 615, 653, 725, 718),
  ('CHEM',   'Chem Engg & Physics Dept',   'classroom', 243, 470, 323, 548),
  ('TELE',   'Telecommunication Dept',     'classroom', 363, 470, 473, 522),
  ('MING',   'Mingos Canteen',             'canteen',   473, 470, 523, 522),
  ('LIB',    'Library',                    'library',   243, 573, 430, 635),
  ('ISE',    'ISE & Aerospace Dept',       'classroom', 243, 635, 430, 718),
]
FLOORS, PER_FLOOR, GAP = 3, 5, 0.0
CSE_PLAN = [['classroom', 'lab', 'classroom', 'lab', 'seminar'],
            ['lab', 'classroom', 'lab', 'classroom', 'classroom'],
            ['classroom', 'lab', 'classroom', 'lab', 'lab']]
CSE_LABEL = {'classroom': 'Classroom', 'lab': 'Computer lab', 'seminar': 'Seminar hall'}
FLOOR_TAG = ['0', '1', '2']

def room_shapes(w, d):
    """5 rooms per floor. Long thin blocks: one row. Deep blocks: 3 + 2 with a corridor."""
    long_is_w = w >= d
    L, Sh = (w, d) if long_is_w else (d, w)
    shapes = []
    if Sh > 18:
        corr = 3.0
        rowh = (Sh - corr) / 2
        for row, n in ((0, 3), (1, 2)):
            for i in range(n):
                a, b = i * L / n, row * (rowh + corr)
                shapes.append((a, b, L / n, rowh))
    else:
        for i in range(PER_FLOOR):
            shapes.append((i * L / PER_FLOOR, 0, L / PER_FLOOR, Sh))
    out = []
    for a, b, la, sb in shapes:
        x, y, ww, hh = (a, b, la, sb) if long_is_w else (b, a, sb, la)
        out.append({'x': round(x, 3), 'y': round(y, 3), 'w': round(ww - 0.01, 3), 'h': round(hh - 0.01, 3)})
    return out

buildings, rooms = [], []
for bid, name, kind, x0, y0, x1, y1 in B:
    w, d = round((x1 - x0) * S - 0.1, 2), round((y1 - y0) * S - 0.1, 2)
    cx, cz = X((x0 + x1) / 2), Z((y0 + y1) / 2)
    buildings.append({'_id': bid, 'name': name, 'floors': FLOORS, 'footprint': {'x': cx, 'z': cz, 'w': w, 'd': d}})
    if bid == 'CSE':
        # CSE has a detailed walk-through (client/src/scenes/csLayout.js): stairs/lift core at the west end,
        # five rooms along the north side, corridor along the south. Keep these numbers in sync with that file.
        CORE_W, ROOM_W, ROOM_D = 5.5, 9.08, 7.4
        for f in range(FLOORS):
            for i, k in enumerate(CSE_PLAN[f]):
                num = f'{FLOOR_TAG[f]}0{i + 1}'
                rooms.append({'_id': f'CSE-{num}', 'buildingId': 'CSE', 'floor': f, 'name': f'{CSE_LABEL[k]} {num}',
                              'kind': 'lab' if k == 'lab' else 'classroom',
                              'shape': {'x': round(CORE_W + i * ROOM_W + 0.1, 3), 'y': 0, 'w': round(ROOM_W - 0.2, 3), 'h': ROOM_D}})
        continue
    shapes = room_shapes(w, d)
    for f in range(FLOORS):
        for i, sh in enumerate(shapes):
            num = f'{FLOOR_TAG[f]}0{i + 1}'
            rooms.append({'_id': f'{bid}-{num}', 'buildingId': bid, 'floor': f, 'name': f'Room {num}', 'kind': kind, 'shape': sh})

campus = {
  'note': 'Traced from the official campus map (0.3 m per map pixel). 3 floors x 5 rooms per building. Edit names/sizes here, then npm run seed:campus -- --prune.',
  'buildings': buildings, 'rooms': rooms,
}
json.dump(campus, open(f'{ROOT}/server/data/campus.json', 'w'), indent=2)

# ---------- site plan ----------
def P(pts): return [[X(x), Z(y)] for x, y in pts]
def R(x0, y0, x1, y1): return {'x': X((x0 + x1) / 2), 'z': Z((y0 + y1) / 2), 'w': round((x1 - x0) * S, 2), 'd': round((y1 - y0) * S, 2)}
site = {
  'boundary': P([(33, 105), (725, 105), (725, 745), (200, 745), (123, 690), (33, 690)]),
  'roads': [P(r) for r in [
      [(147, 105), (147, 615), (205, 732), (540, 732), (540, 325), (510, 285), (147, 285)],
      [(147, 140), (400, 140)],
      [(400, 98), (400, 285)],
      [(147, 455), (540, 455)],
      [(540, 334), (725, 334)],
      [(540, 414), (725, 414)],
      [(540, 646), (725, 646)],
      [(330, 500), (437, 566), (437, 732)],
      [(238, 351), (395, 351)],
  ]],
  'ground': R(535, 115, 715, 285),
  'parking': R(172, 108, 348, 126),
  'gardens': [R(*g) for g in [
      (473, 528, 523, 594), (443, 600, 523, 640), (443, 652, 523, 690), (443, 696, 523, 718),
      (555, 418, 652, 438), (555, 495, 612, 600), (555, 655, 612, 718),
      (33, 485, 123, 688), (172, 264, 350, 303), (172, 357, 231, 437), (237, 307, 288, 343),
  ]],
  'temple': R(656, 418, 723, 438),
  'statue': [X(50), Z(285)],
  'entrance': [X(392), Z(100)],
  'security': R(350, 106, 412, 126),
}
js = '// Generated from the campus map, same coordinates as server/data/campus.json (metres, 0.3 m per map pixel).\n'
js += '// Flat site features drawn under the buildings: roads, grounds, gardens and landmarks.\n'
js += 'export const SITE = ' + json.dumps(site, indent=2) + ';\n'
open(f'{ROOT}/client/src/config/siteplan.js', 'w').write(js)
print(len(buildings), 'buildings', len(rooms), 'rooms')
xs=[b['footprint']['x'] for b in buildings]; print('x range', min(xs), max(xs))
