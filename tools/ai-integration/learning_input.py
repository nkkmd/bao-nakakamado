"""NYAKUA binary input, adapted conceptually from the fixed PBAI-P6 encoder.

Copyright (c) 2026 cultivationdata.net. MIT; see prototype/ENGINE_LICENSE.txt.
This layout is incompatible with the source's 399-bit trained model.
"""
import json
import sys

ENCODING_ID = 'NAKAKAMADO-BINARY-v1'
INPUT_SIZE = 368


def encode(state, perspective):
    def integer(n, maximum):
        return type(n) is int and 0 <= n <= maximum

    if type(perspective) is not int or perspective not in (0, 1):
        raise ValueError('Perspective')
    if (type(state['player']) is not int or state['player'] not in (0, 1)
            or state['phase'] not in ('namua', 'mtaji')
            or state['winner'] is not None or state['reason'] != ''
            or not integer(state['turn'], 2**53 - 1)):
        raise ValueError('Only ongoing v0.8.0 states are encodable')
    for field in ('pits', 'reserve', 'nyakuaReserve', 'pending', 'houseOwned'):
        if type(state[field]) is not list or len(state[field]) != 2:
            raise ValueError('State shape')
    total = 0
    for side in (0, 1):
        rows = state['pits'][side]
        if type(rows) is not list or len(rows) != 2:
            raise ValueError('Rows')
        for row in rows:
            if type(row) is not list or len(row) != 8 or not all(integer(n, 64) for n in row):
                raise ValueError('Pit range')
            total += sum(row)
        if (not integer(state['reserve'][side], 64)
                or not integer(state['nyakuaReserve'][side], 1)
                or not integer(state['pending'][side], 0)
                or type(state['houseOwned'][side]) is not bool):
            raise ValueError('Hand, pending or house range')
        total += state['reserve'][side] + state['nyakuaReserve'][side]
    if total != 64:
        raise ValueError('Total KETE must be 64')
    if state['phase'] == 'mtaji' and any(state['reserve'] + state['nyakuaReserve']):
        raise ValueError('MTAJI hand must be empty')
    sides = (perspective, 1-perspective)
    features = []
    for side in sides:
        for row in state['pits'][side]:
            for count in row:
                features.extend((count >> bit) & 1 for bit in range(7))
                features.extend(int(count >= threshold) for threshold in (1, 2, 4))
    for side in sides:
        features.extend((state['reserve'][side] >> bit) & 1 for bit in range(7))
    features.extend(state['nyakuaReserve'][side] for side in sides)
    for side in sides:
        features.extend((state['pending'][side] >> bit) & 1 for bit in range(7))
    features.extend(int(state['houseOwned'][side]) for side in sides)
    features.extend((int(state['player'] == perspective), int(state['phase'] == 'mtaji')))
    for side in sides:
        extra = state['nyakuaReserve'][side]
        placement = min(state['reserve'][side], 2 if extra else 1) + extra if state['phase'] == 'namua' else 0
        features.extend(int(placement == count) for count in range(4))
    for side in sides:
        features.extend(int(state['reserve'][side] == count) for count in range(3))
    assert len(features) == INPUT_SIZE
    return features


if __name__ == '__main__':
    rows = json.load(sys.stdin)
    json.dump([encode(row['state'], row['perspective']) for row in rows], sys.stdout)
    sys.stdout.write('\n')
