# Use a hybrid campus traversal network

Campus routing will compile curved traversal links, freely walkable areas, obstacles, building passages, portals, levels, and dynamic access rules into one queryable network behind the `CampusNavigator` interface. This deliberately avoids both a line-only road graph, which cannot represent open areas, and a universal navigation mesh, which obscures named paths, schedules, indoor passages, and accessibility constraints; v1 straight road graphs migrate into the v2 model as ordinary outdoor traversal links.
