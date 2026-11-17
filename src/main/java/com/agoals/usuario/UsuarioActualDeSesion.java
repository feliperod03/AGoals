package com.agoals.usuario;

import com.agoals.common.UsuarioActual;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Lee el usuario autenticado de la sesión. Si no hay ninguno lanza una excepción: no debería pasar,
 * porque el filtro de seguridad responde 401 antes de llegar a un controller.
 */
@Component
public class UsuarioActualDeSesion implements UsuarioActual {

	@Override
	public Long id() {
		Authentication auth = SecurityContextHolder.getContextHolderStrategy().getContext().getAuthentication();
		if (auth == null || !(auth.getPrincipal() instanceof UsuarioAutenticado principal)) {
			throw new UsuarioNoAutenticadoException();
		}
		return principal.getId();
	}
}
