package com.agoals.common;

/**
 * Usuario dueño de la petición en curso (la implementación real, UsuarioActualDeSesion, lo lee de la sesión).
 * Los services son singletons: hay que llamar a {@link #id()} DENTRO de cada
 * método (o guardarlo en una variable local), nunca en un campo ni en una constante, porque con la sesión
 * el valor cambia de una petición a otra.
 */
public interface UsuarioActual {

	Long id();
}
