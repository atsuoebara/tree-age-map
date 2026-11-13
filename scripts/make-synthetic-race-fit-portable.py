#!/usr/bin/env python3
"""Minimal public-safe FIT fixture generator: synthetic 5km/27min, no private data."""
import struct
from datetime import datetime, timezone
from pathlib import Path
import sys

TABLE=(0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,
       0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400)
def crc_fit(data):
    crc=0
    for byte in data:
        crc=((crc>>4)&0x0fff)^TABLE[crc&15]^TABLE[byte&15]
        crc=((crc>>4)&0x0fff)^TABLE[crc&15]^TABLE[(byte>>4)&15]
    return crc

def definition(local, global_num, fields):
    return bytes([0x40|local,0,0])+struct.pack('<H',global_num)+bytes([len(fields)])+b''.join(bytes(f) for f in fields)

def make_synthetic_fit():
    epoch=datetime(1989,12,31,tzinfo=timezone.utc)
    start=datetime(2020,1,1,tzinfo=timezone.utc)  # arbitrary day, not real user's run
    start_s=int((start-epoch).total_seconds())
    laps=(315,318,320,324,343)
    data=bytearray()
    data+=definition(0,18,[(253,4,0x86),(2,4,0x86),(9,4,0x86),(5,1,0x00)])
    data+=b'\x00'+struct.pack('<IIIB',start_s+sum(laps),start_s,500000,1)
    data+=definition(1,20,[(253,4,0x86),(5,4,0x86)])
    records=[(0,0)]
    elapsed=0
    for km,duration in enumerate(laps):
        for part in range(1,6):
            records.append((elapsed+round(duration*part/5),km*1000+part*200))
        elapsed+=duration
    for t,d in records:
        data+=b'\x01'+struct.pack('<II',start_s+t,d*100)
    hdr12=struct.pack('<BBHI4s',14,0x20,2140,len(data),b'.FIT')
    payload=hdr12+struct.pack('<H',crc_fit(hdr12))+data
    return payload+struct.pack('<H',crc_fit(payload))

if __name__=='__main__':
    if len(sys.argv)!=2 or not sys.argv[1].lower().endswith('.fit'):
        raise SystemExit('Usage: python scripts/make-synthetic-race-fit-portable.py output.fit')
    output=Path(sys.argv[1])
    with output.open('xb') as f:
        f.write(make_synthetic_fit())
    print(f'Synthetic 5km fixture: {output} ({output.stat().st_size} bytes)')
