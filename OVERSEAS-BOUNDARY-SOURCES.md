# 海外境界データ — 2026-10-06

## 新規ファイル
geoBoundaries gbOpen, revision `9469f09`。座標・境界の簡略化済み配布版を使用。

| 国 | レベル | 件数 | 出典 | ライセンス |
| --- | --- | ---: | --- | --- |
| ソロモン諸島 | ADM1 | 10 | Natural Earth (2021) | Public Domain |
| ソロモン諸島 | ADM2 | 50 | SINSO / OCHA ROAP (2018) | CC BY 3.0 IGO |
| ロシア | ADM1 | 83 | OpenStreetMap / Wambacher (2017) | ODbL 1.0 |
| ロシア | ADM2 + 連邦市 | 2329 | OpenStreetMap / Wambacher (2017) | ODbL 1.0 |

ロシアのADM2配布版は2327件。モスクワ・サンクトペテルブルクが含まれないため、同じ配布版のADM1からこの2都市を追加。shapeIDは配布元の値を保持、boundaryRole=federal_city_fallbackを付与。通常の地区境界は変更していない。表示・EXPLORE・Territoryでは地区／市として扱う。

取得元：https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen
API：https://www.geoboundaries.org/api.html
ODbL：https://opendatacommons.org/licenses/odbl/1-0/
CC BY 3.0 IGO：https://creativecommons.org/licenses/by/3.0/igo/
OpenStreetMap contributors：https://www.openstreetmap.org/copyright

新規GeoJSONの再配布時は本ファイルも併せて公開する。ロシアのデータおよび上記派生データはODbL 1.0で提供。

## 継続課題
ケイマン諸島：gbOpenのADM1/ADM2が取得できない。Cayman Land Infoの地区境界サービスは見つかったが、再配布条件を確認できていないため、今回の対応済みリストには追加していない。国別総距離チップは引き続き表示される。

現在の年・EXPLORE参加者だけを調べる既存のcoverage検出は、全年・全ユーザーを対象にした国別距離集計と範囲が異なる。検出ゼロを全世界の対応完了とは扱わない。
