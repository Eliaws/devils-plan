import { motion } from 'motion/react';

// Gerbe d'étincelles quand un monstre est abattu. Trajectoires fixes (pas d'aléatoire au rendu).
const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 3) * 0.2;
  const distance = 70 + ((i * 37) % 60);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 20,
    size: 4 + (i % 4) * 2,
    color: ['#ffd27a', '#f76b15', '#e3ac52', '#ffffff'][i % 4]!,
    delay: (i % 5) * 0.03,
  };
});

export function Embers({ burstKey }: { burstKey: number }) {
  return (
    <div key={burstKey} className="pointer-events-none absolute top-1/2 left-1/2 z-20 size-0" aria-hidden>
      {SPARKS.map((spark, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: spark.size,
            height: spark.size,
            background: spark.color,
            boxShadow: `0 0 10px 2px ${spark.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: spark.x * 1.6, y: spark.y * 1.6 + 60, opacity: 0, scale: 0.3 }}
          transition={{ duration: 1.1, delay: spark.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
