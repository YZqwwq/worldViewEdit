export interface MapLocation {
  id: string;
  name: string;
  description: string;
  position: {
    x: number;
    y: number;
  };
  type: string;
  connections: string[];
}

export interface MapConnection {
  id: string;
  from: string;
  to: string;
  type: string;
  description: string;
}

export interface MapData {
  name: string;
  description: string;
  locations: MapLocation[];
  connections: MapConnection[];
} 