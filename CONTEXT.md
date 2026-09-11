# Campus Traversal

This context describes where a pedestrian may move through campus and which route is preferable under access, comfort, time, and accessibility constraints.

## Language

**Campus Traversal Network**:
The complete set of traversable links, freely traversable areas, portals, places, and their current access rules.
_Avoid_: Road graph, map lines

**Traversal Node**:
A topological position where traversal links meet, end, change level, or connect to a traversable area.
_Avoid_: Point, dot

**Portal**:
A traversal node that connects different environments, areas, buildings, or levels, such as a gate, doorway, stair, or lift landing.
_Avoid_: Entrance point, connector

**Place**:
A named campus destination associated with a traversal node or traversable area and discoverable by users.
_Avoid_: Label, POI

**Traversal Link**:
A directed or bidirectional traversable corridor between two traversal nodes, with its own geometry, environment, and access rule.
_Avoid_: Edge, road segment

**Walkable Area**:
A bounded surface in which a pedestrian may move freely except through its obstacles.
_Avoid_: Open space, field polygon

**Obstacle**:
A bounded part of a walkable area through which traversal is not permitted.
_Avoid_: Hole, blocked polygon

**Building Passage**:
A designated sequence of traversal links through a building that may be used as part of a route rather than merely as a destination.
_Avoid_: Walk-through building, shortcut

**Level**:
A named vertical plane on which traversal nodes, links, areas, and portals are located.
_Avoid_: Floor number

**Access Rule**:
The audience, schedule, temporary state, direction, and mobility constraints that decide whether traversal is currently permitted.
_Avoid_: Permission flag, open status

**Travel Environment**:
The exposure conditions of a traversal link or walkable area, including indoor, covered, shaded, and outdoor conditions.
_Avoid_: Road type

**Route Profile**:
A declared preference that ranks otherwise valid routes, such as fastest, balanced, less sun, rain protected, or accessible.
_Avoid_: Weight mode, algorithm option

**Image Coordinate**:
A normalized position on the unchanged campus illustration, where x and y are both between 0 and 1. It is a display coordinate, not a geographic measurement.
_Avoid_: GPS point, map longitude

**Reference Coordinate**:
A coordinate copied from the external calibration provider together with its declared coordinate reference system, such as BD09MC or BD09.
_Avoid_: Latitude when the source is projected, GPS coordinate

**WGS-84 Coordinate**:
The geographic latitude and longitude used by browser geolocation and by the navigation application's Earth-position interface.
_Avoid_: Baidu coordinate, exact surveyed point when converted from an offset map

**Calibration Anchor**:
A reviewed pair that identifies the same physical landmark in image coordinates, provider reference coordinates, and WGS-84 coordinates, including source and expected accuracy.
_Avoid_: Traversal node, place label, unverified click

**Map Calibration**:
The reproducible relationship computed from calibration anchors that converts between the unchanged campus illustration and WGS-84/local metric space.
_Avoid_: Image resize, map replacement, meters-per-pixel value

**Calibration Quality**:
The anchor count, spatial coverage, residual diagnostics, and declared source accuracy used to communicate where a calibration is reliable. A mathematical fit residual is not field-survey accuracy.
_Avoid_: Precision badge, GPS accuracy

**Reference Layer**:
External map geometry or places used for visual comparison and review. Reference features do not become traversable links or destinations until a person promotes them.
_Avoid_: Imported road network, automatic route data
