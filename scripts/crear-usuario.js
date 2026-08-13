require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

async function main() {
  const [, , nombre, email, password, rol] = process.argv;

  if (!nombre || !email || !password || !rol) {
    console.log('Uso: node scripts/crear-usuario.js "Nombre Apellido" email@ejemplo.com contraseña rol');
    console.log('rol debe ser: admin, operario o auditor');
    process.exit(1);
  }
  if (!['admin', 'operario', 'auditor'].includes(rol)) {
    console.log('Error: el rol tiene que ser admin, operario o auditor');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES (${nombre}, ${email}, ${hash}, ${rol})
    `;
    console.log(`Usuario creado: ${email} (${rol})`);
  } catch (error) {
    console.error('No se pudo crear el usuario:', error.message);
  }
}

main();