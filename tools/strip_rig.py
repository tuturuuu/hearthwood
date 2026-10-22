"""Shrink a KayKit animation rig .glb: keep the skeleton and only the clips we use.

Drops the mannequin meshes, skins, materials and every unused animation, then re-packs the binary buffer.
Usage: python3 tools/strip_rig.py in.glb out.glb Clip_A Clip_B ...
"""
import json
import struct
import sys


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, _ = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'not a glb'
    offset, js, binary = 12, None, b''
    while offset < len(data):
        length, kind = struct.unpack_from('<II', data, offset)
        chunk = data[offset + 8: offset + 8 + length]
        if kind == 0x4E4F534A:
            js = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
    return js, binary


def write_glb(path, js, binary):
    body = json.dumps(js, separators=(',', ':')).encode()
    body += b' ' * (-len(body) % 4)
    binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(body) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(body), 0x4E4F534A) + body)
        f.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


def strip(src, dst, keep):
    js, binary = read_glb(src)
    anims = [a for a in js.get('animations', []) if a['name'] in keep]
    missing = set(keep) - {a['name'] for a in anims}
    if missing:
        raise SystemExit(f'{src}: clips not found: {sorted(missing)}')

    # re-pack only the accessors the kept clips use
    new_accessors, new_views, chunks, remap = [], [], [], {}
    cursor = 0
    for a in anims:
        for sampler in a['samplers']:
            for key in ('input', 'output'):
                old = sampler[key]
                if old not in remap:
                    acc = dict(js['accessors'][old])
                    view = js['bufferViews'][acc['bufferView']]
                    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
                    comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[acc['type']]
                    size = {5126: 4, 5123: 2, 5125: 4, 5121: 1}[acc['componentType']]
                    length = acc['count'] * comps * size
                    if view.get('byteStride') and view['byteStride'] != comps * size:
                        raise SystemExit('interleaved animation data is not supported')
                    chunk = binary[start:start + length]
                    chunk += b'\0' * (-len(chunk) % 4)
                    new_views.append({'buffer': 0, 'byteOffset': cursor, 'byteLength': length})
                    chunks.append(chunk)
                    cursor += len(chunk)
                    acc['bufferView'] = len(new_views) - 1
                    acc.pop('byteOffset', None)
                    remap[old] = len(new_accessors)
                    new_accessors.append(acc)
                sampler[key] = remap[old]

    nodes = []
    for n in js['nodes']:
        n = {k: v for k, v in n.items() if k not in ('mesh', 'skin')}
        nodes.append(n)

    out = {
        'asset': js['asset'],
        'scene': js.get('scene', 0),
        'scenes': js['scenes'],
        'nodes': nodes,
        'animations': anims,
        'accessors': new_accessors,
        'bufferViews': new_views,
        'buffers': [{'byteLength': cursor}],
    }
    write_glb(dst, out, b''.join(chunks))


if __name__ == '__main__':
    strip(sys.argv[1], sys.argv[2], set(sys.argv[3:]))
