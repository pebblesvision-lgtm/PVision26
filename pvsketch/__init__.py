"""pvsketch - photo to true-scale production outline for stone restoration.

Pipeline:
    1. calibrate  - homography from a known reference (A4 sheet, custom rectangle,
                    printed ArUco marker) so the image plane is in millimetres
    2. segment    - isolate the stone from the background (GrabCut, offline)
    3. contour    - extract, simplify and arc-fit the outer outline; optional
                    detail lines from Canny inside the mask
    4. export     - SVG / DXF at true scale (mm) with dimension annotations
"""

__version__ = "0.1.0"
