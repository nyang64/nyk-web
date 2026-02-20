import { useEffect, useRef } from 'react';
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "NYK Labs - Engineering, Data & Blockchain Innovation" },
    { name: "description", content: "NYK Labs – Engineering, data, and blockchain innovation." },
  ];
}

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    let renderer: any;
    let animationId: number;
    let mounted = true;

    const initGlobe = async () => {
      try {
        const THREE = await import('three');
        const ThreeGlobe = (await import('three-globe')).default;

        if (!mounted || !mountRef.current) return;

        const container = mountRef.current;
        
        // Detect if mobile/tablet
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        
        // Simplified configuration for better performance
        const config = {
          satelliteSize: 0.8, // Larger satellites (was 0.36)
          pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio, 2),
          cameraDistance: isMobile ? 320 : 300
        };
        
        // Scene setup
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xcccccc, 1));
        scene.add(new THREE.DirectionalLight(0xffffff, 0.8));

        // Camera setup
        const camera = new THREE.PerspectiveCamera();
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        camera.position.z = config.cameraDistance;

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: !isMobile }); // Disable antialiasing on mobile for performance
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(config.pixelRatio);
        container.appendChild(renderer.domElement);

        // Globe setup
        const Globe = new ThreeGlobe({ animateIn: false })
          .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
          .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png');

        scene.add(Globe);

        // Only 4 satellites in specific orbital planes for better performance
        // Each satellite follows a different orbital plane
        const satellites = [
          // Equatorial orbit (around equator)
          { id: 'equator', lat: 0, lng: 0, alt: 0.3, orbitPlane: 'equator' },
          // Polar orbit (north-south)
          { id: 'polar', lat: 90, lng: 0, alt: 0.3, orbitPlane: 'polar' },
          // Diagonal orbit 1 (northeast-southwest)
          { id: 'diagonal1', lat: 45, lng: 45, alt: 0.3, orbitPlane: 'diagonal1' },
          // Diagonal orbit 2 (northwest-southeast)
          { id: 'diagonal2', lat: 45, lng: -45, alt: 0.3, orbitPlane: 'diagonal2' }
        ];

        // Add satellites - larger and easier to see
        Globe.objectsData(satellites)
          .objectLat('lat')
          .objectLng('lng')
          .objectAltitude('alt')
          .objectThreeObject(() => {
            const material = new THREE.MeshLambertMaterial({
              color: '#22d3ee',
              emissive: '#22d3ee',
              emissiveIntensity: 0.8
            });
            return new THREE.Mesh(
              new THREE.SphereGeometry(config.satelliteSize, 8, 8),
              material
            );
          });

        // Animation
        let angle = 0;
        const animate = () => {
          if (!mounted) return;

          // Rotate globe slowly
          angle += 0.001;
          Globe.rotation.y = angle;

          // Move satellites along their specific orbital planes
          const speed = 0.5; // degrees per frame
          
          satellites.forEach((sat) => {
            if (sat.orbitPlane === 'equator') {
              // Move along equator (constant latitude 0)
              sat.lng += speed;
              if (sat.lng > 180) sat.lng = -180;
            } else if (sat.orbitPlane === 'polar') {
              // Move along polar orbit (north-south)
              sat.lat += speed;
              if (sat.lat > 90) sat.lat = -90;
            } else if (sat.orbitPlane === 'diagonal1') {
              // Move along northeast-southwest diagonal
              sat.lng += speed;
              sat.lat = 45 * Math.sin((sat.lng * Math.PI) / 180);
              if (sat.lng > 180) sat.lng = -180;
            } else if (sat.orbitPlane === 'diagonal2') {
              // Move along northwest-southeast diagonal
              sat.lng += speed;
              sat.lat = 45 * Math.sin(((sat.lng + 90) * Math.PI) / 180);
              if (sat.lng > 180) sat.lng = -180;
            }
          });
          
          Globe.objectsData(satellites);

          // Very gentle camera movement (disabled on mobile to save battery)
          if (!isMobile) {
            camera.position.x = Math.sin(angle * 0.3) * 15;
            camera.lookAt(scene.position);
          }

          renderer.render(scene, camera);
          animationId = requestAnimationFrame(animate);
        };

        animate();

        // Handle window resize
        const handleResize = () => {
          if (!container || !mounted) return;
          const width = container.clientWidth;
          const height = container.clientHeight;
          
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
          mounted = false;
          window.removeEventListener('resize', handleResize);
          if (animationId) {
            cancelAnimationFrame(animationId);
          }
          if (renderer) {
            if (container && container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
            renderer.dispose();
          }
          scene.clear();
        };

      } catch (error) {
        console.error('Three.js globe error:', error);
        if (mountRef.current) {
          mountRef.current.innerHTML = '<div style="color: #22d3ee; text-align: center; padding: 2rem;">Loading globe visualization...</div>';
        }
      }
    };

    const cleanup = initGlobe();
    
    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((fn: any) => fn && fn());
      }
    };
  }, []);

  return (
    <>
      <style>{`
        .globe-home {
          padding: 0 !important;
          margin: 0 !important;
          display: block !important;
          width: 100%;
          min-height: calc(100vh - 180px);
          background: radial-gradient(circle at center, #0a0a2a, #020617);
          position: relative;
        }
        
        .globe-container {
          width: 100%;
          height: calc(100vh - 180px);
          min-height: 600px;
          position: relative;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .globe-container {
            min-height: 500px;
            height: calc(100vh - 150px); /* Smaller nav/footer on mobile */
          }
        }

        @media (max-width: 480px) {
          .globe-container {
            min-height: 400px;
          }
        }
      `}</style>
      
      <main className="globe-home">
        <div ref={mountRef} className="globe-container" />
      </main>
    </>
  );
}
