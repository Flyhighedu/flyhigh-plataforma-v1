"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function ListView({ contacts, statusFilter, onSelectContact }) {
  // Filter contacts by status ('won' or 'lost')
  const filtered = useMemo(() => {
    return contacts
      .filter((c) => c.lead_status === statusFilter)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [contacts, statusFilter]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-full w-full">
        <div className="text-4xl mb-4">{statusFilter === 'won' ? '🏆' : '🗑️'}</div>
        <p>No hay contactos en esta vista.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
            <tr>
              <th className="px-6 py-4 font-semibold">Contacto</th>
              <th className="px-6 py-4 font-semibold">CCT / Escuela</th>
              <th className="px-6 py-4 font-semibold">Último Mensaje</th>
              <th className="px-6 py-4 font-semibold text-right">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((contact) => (
              <tr 
                key={contact.id} 
                onClick={() => onSelectContact(contact)}
                className="hover:bg-muted/50 cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{contact.contact_name || 'Desconocido'}</div>
                  <div className="text-xs text-muted-foreground">{contact.phone_number}</div>
                </td>
                <td className="px-6 py-4">
                  {contact.cct ? (
                    <div>
                      <div className="font-medium">{contact.school_name || contact.cct}</div>
                      <div className="text-xs text-muted-foreground">Turno: {contact.school_turno || '--'}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Sin escuela identificada</span>
                  )}
                </td>
                <td className="px-6 py-4 max-w-[250px] truncate">
                  <span className="text-muted-foreground">
                     {contact.last_user_message || 'Sin mensajes'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(contact.updated_at), { addSuffix: true, locale: es })}
                  <div className="text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click para ver
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
