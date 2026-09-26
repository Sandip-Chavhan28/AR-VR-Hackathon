export default function RocketPlume() {
  return (
    <mesh position={[0, -12, 0]}>

      <coneGeometry
        args={[4, 16, 32]}
      />

      <meshBasicMaterial
        color="#ff7700"
      />

    </mesh>
  );
}