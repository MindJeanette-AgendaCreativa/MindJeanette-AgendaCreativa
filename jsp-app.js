/**
 * JSP SEGUROS · JEANETTE SALINAS PONCE
 * Motor interactivo: Bilingüe (ES/EN), Selector Modular (Feather),
 * Cotizador Express SOAPEX/RCI y WhatsApp Inteligente Contextual.
 */

// Teléfono oficial de Jeanette (formato internacional sin '+' para wa.me)
// Configurable según requerimiento de Jeanette
const JEANETTE_PHONE = "56999999999"; 

// Textos bilingües
const translations = {
  es: {
    brand_sub: "Corredora Oficial de Seguros · CMF",
    nav_services: "Seguros",
    nav_travelers: "Viajeros & SOAPEX",
    nav_method: "Cómo te ayudo",
    nav_alliances: "Alianzas B2B",
    nav_cta: "Asesoría Gratuita",
    
    hero_tag: "Corredora Oficial de Seguros · Jeanette Salinas Ponce",
    hero_title: 'Tu tranquilidad asegurada. <br><span class="highlight">Yo gestiono por ti.</span>',
    hero_desc: "Asesoría fiduciaria e independiente para personas, familias, empresas y viajeros de todo el mundo. Evaluamos tus coberturas, encontramos la mejor opción del mercado y te defendemos en caso de siniestro.",
    hero_btn_primary: "Solicitar Asesoría Gratuita",
    hero_btn_soapex: "Cotizar SOAPEX / RCI",
    hero_trust_1: "Registro CMF Oficial",
    hero_trust_2: "100% Independiente",
    hero_trust_3: "Sin costo extra para ti",

    profile_name: "Jeanette Salinas Ponce",
    profile_role: "Corredora Oficial de Seguros",
    profile_badge: "Registro CMF Verificado",
    stat_1_num: "100%",
    stat_1_label: "Asesoría Fiduciaria e Imparcial",
    stat_2_num: "+15",
    stat_2_label: "Aseguradoras Reguladas",
    profile_box_text: "¿Tienes dudas sobre una póliza o tuviste un siniestro?",
    profile_box_btn: "Hablar con Jeanette",

    quote_tagline: "Filosofía Fiduciaria",
    quote_text: "«¿Qué tanto estoy creciendo, pero qué tanto estoy contribuyendo?»",
    quote_author: "— Jeanette Salinas Ponce, Corredora de Seguros",

    services_tag: "Catálogo Modular",
    services_title: "Protección a tu medida, sin letra chica",
    services_desc: "Selecciona tu perfil para conocer las coberturas principales. Si necesitas un ramo específico, yo lo gestiono de inmediato.",
    tab_personal: "Personas y Familias",
    tab_business: "Empresas y Pymes",
    tab_travelers: "Viajeros & Tránsito Internacional",

    wizard_badge: "Puerta de Entrada Internacional",
    wizard_title: "Ingreso a Chile & Mercosur",
    wizard_desc: "Emisión ágil del seguro obligatorio SOAPEX para ingresar a Chile y cobertura RCI para transitar en países del Mercosur.",
    wizard_b1: "Obligatorio por ley para aduanas y pasos fronterizos.",
    wizard_b2: "Válido para autos, camionetas, motos y casas rodantes.",
    wizard_b3: "Emisión digital inmediata enviada a tu correo y WhatsApp.",
    
    wizard_form_title: "Cotizador Express SOAPEX & RCI",
    wizard_label_type: "¿Qué seguro necesitas?",
    wizard_opt_soapex: "SOAPEX (Vehículo extranjero entrando a Chile)",
    wizard_opt_rci: "RCI Mercosur (Vehículo chileno saliendo a Argentina/Brasil)",
    wizard_opt_travel: "Asistencia Médica en Viaje Internacional",
    wizard_label_vehicle: "Tipo de Vehículo",
    wizard_label_country: "País de Origen / Matrícula",
    wizard_label_duration: "Tiempo de Estadía / Cobertura",
    wizard_btn: "Solicitar Emisión con Jeanette",

    method_tag: "Metodología Fiduciaria",
    method_title: "Cómo te acompaño en 4 pasos",
    method_desc: "Un proceso transparente, personal y humano frente a la burocracia bancaria.",
    step1_title: "01. Escucho tus necesidades",
    step1_desc: "Conversamos brevemente para entender qué te preocupa proteger, tu presupuesto y necesidades reales.",
    step2_title: "02. Comparo el mercado",
    step2_desc: "Busco de forma 100% imparcial entre las más de 15 aseguradoras reguladas por la CMF en Chile.",
    step3_title: "03. Te explico la letra chica",
    step3_desc: "En lenguaje simple, sin tecnicismos opacos: sabrás exactamente qué te cubre y qué no ante cualquier evento.",
    step4_title: "04. Yo gestiono por ti",
    step4_desc: "Te acompaño durante la vigencia de la póliza y defiendo tus derechos técnicos ante la aseguradora en caso de siniestro.",

    alliances_tag: "Canal B2B",
    alliances_title: "Alianzas Comerciales & Convenios",
    alliances_desc: "Generamos alianzas de valor con agencias de viaje, tour operadores, empresas de transporte y rent-a-car. Protege a tus clientes y pasajeros con condiciones preferentes y respaldo profesional continuo.",
    alliances_btn: "Coordinar Reunión de Alianza",

    carriers_title: "Operamos de forma independiente con las principales aseguradoras reguladas por la CMF",
    
    footer_desc: "Asesoría fiduciaria independiente en seguros generales, vida, salud y tránsito internacional. Comprometida con proteger tu patrimonio y acompañarte cuando más lo necesitas.",
    footer_rights: "© 2026 JSP Seguros · Jeanette Salinas Ponce. Todos los derechos reservados."
  },

  en: {
    brand_sub: "Official Licensed Insurance Broker · CMF Chile",
    nav_services: "Insurances",
    nav_travelers: "Travelers & SOAPEX",
    nav_method: "Our Method",
    nav_alliances: "B2B Partnerships",
    nav_cta: "Free Consultation",
    
    hero_tag: "Official Licensed Broker · Jeanette Salinas Ponce",
    hero_title: 'Your peace of mind secured. <br><span class="highlight">I handle everything for you.</span>',
    hero_desc: "Fiduciary and independent insurance brokerage for individuals, families, businesses, and international travelers entering Chile. We audit your coverage, select the best market policy, and advocate for you in any claim.",
    hero_btn_primary: "Request Free Consultation",
    hero_btn_soapex: "Quote SOAPEX / RCI",
    hero_trust_1: "Official CMF License",
    hero_trust_2: "100% Independent",
    hero_trust_3: "No extra fee for you",

    profile_name: "Jeanette Salinas Ponce",
    profile_role: "Official Insurance Broker",
    profile_badge: "Verified CMF License",
    stat_1_num: "100%",
    stat_1_label: "Fiduciary & Impartial Advice",
    stat_2_num: "+15",
    stat_2_label: "Regulated Insurers",
    profile_box_text: "Need policy advice or dealing with a recent claim?",
    profile_box_btn: "Chat with Jeanette",

    quote_tagline: "Fiduciary Philosophy",
    quote_text: "«How much am I growing, but more importantly, how much am I truly contributing?»",
    quote_author: "— Jeanette Salinas Ponce, Licensed Insurance Broker",

    services_tag: "Modular Catalog",
    services_title: "Tailored protection with zero fine print",
    services_desc: "Select your profile to discover core policies. If you need a specialized policy, I will manage it immediately.",
    tab_personal: "Individuals & Families",
    tab_business: "Businesses & Companies",
    tab_travelers: "Travelers & International Transit",

    wizard_badge: "International Gateway",
    wizard_title: "Entry to Chile & Mercosur Transit",
    wizard_desc: "Fast digital issuance of mandatory SOAPEX insurance for foreign vehicles entering Chile and RCI coverage for Mercosur cross-border travel.",
    wizard_b1: "Mandatory by law for customs, borders and police control.",
    wizard_b2: "Valid for cars, pickups, motorcycles, campervans and RVs.",
    wizard_b3: "Instant digital policy delivered directly to your email and WhatsApp.",
    
    wizard_form_title: "Express SOAPEX & RCI Quoter",
    wizard_label_type: "Select Insurance Type",
    wizard_opt_soapex: "SOAPEX (Foreign vehicle entering Chile)",
    wizard_opt_rci: "RCI Mercosur (Chilean vehicle traveling to Argentina/Brazil)",
    wizard_opt_travel: "Worldwide Travel & Medical Assistance",
    wizard_label_vehicle: "Vehicle Category",
    wizard_label_country: "Country of Registration / License Plate",
    wizard_label_duration: "Duration of Stay / Coverage Period",
    wizard_btn: "Request Instant Issuance with Jeanette",

    method_tag: "Fiduciary Methodology",
    method_title: "How I support you in 4 transparent steps",
    method_desc: "A personalized, human and dedicated process unlike automated banking bureaucracy.",
    step1_title: "01. I listen to your exact needs",
    step1_desc: "We hold a brief talk to understand what you want to protect, your budget, and specific risk profile.",
    step2_title: "02. I compare the entire market",
    step2_desc: "Completely impartial audit across more than 15 CMF-regulated insurance companies in Chile.",
    step3_title: "03. I explain the fine print",
    step3_desc: "Clear language, no opaque jargon: you will understand exact coverages, deductibles and exclusions.",
    step4_title: "04. I manage everything for you",
    step4_desc: "Ongoing policy monitoring and technical representation defending your claim before the insurer.",

    alliances_tag: "B2B Channel",
    alliances_title: "Commercial Partnerships & Tour Operators",
    alliances_desc: "We build high-trust agreements with travel agencies, tour operators, transportation companies, and car rental firms. Protect your travelers with preferred conditions and dedicated assistance.",
    alliances_btn: "Schedule a Partnership Call",

    carriers_title: "We work independently with leading CMF-regulated insurance companies",
    
    footer_desc: "Independent fiduciary insurance advisory in general risks, life, health, and cross-border transit. Committed to protecting your assets and standing by your side when you need it most.",
    footer_rights: "© 2026 JSP Seguros · Jeanette Salinas Ponce. All rights reserved."
  }
};

let currentLang = 'es';
let activeCategory = 'personal';

// Inicialización cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  initTabs();
  initWizard();
  initWhatsApp();
  initModals();
});

/* ==========================================================================
   1. GESTIÓN DE IDIOMA (ES / EN)
   ========================================================================== */
function initLanguage() {
  const savedLang = localStorage.getItem('jsp_lang');
  if (savedLang && (savedLang === 'es' || savedLang === 'en')) {
    setLanguage(savedLang);
  }

  const esBtn = document.getElementById('lang-es');
  const enBtn = document.getElementById('lang-en');

  if (esBtn && enBtn) {
    esBtn.addEventListener('click', () => setLanguage('es'));
    enBtn.addEventListener('click', () => setLanguage('en'));
  }
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('jsp_lang', lang);

  // Actualizar botones de idioma
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`lang-${lang}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Aplicar traducciones según data-i18n
  const dict = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = dict[key];
      } else {
        el.innerHTML = dict[key];
      }
    }
  });

  // Actualizar tooltips y mensajes
  updateWhatsAppTooltip();
}

/* ==========================================================================
   2. SELECTOR MODULAR DE SERVICIOS (FEATHER TABS)
   ========================================================================== */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-target');
      activeCategory = target;
      
      // Mostrar/ocultar contenedores de tarjetas
      document.querySelectorAll('.services-category-group').forEach(group => {
        if (group.id === `group-${target}`) {
          group.style.display = 'grid';
        } else {
          group.style.display = 'none';
        }
      });

      updateWhatsAppTooltip();
    });
  });
}

/* ==========================================================================
   3. COTIZADOR EXPRESS SOAPEX & RCI (INBOUND GATEWAY)
   ========================================================================== */
function initWizard() {
  const form = document.getElementById('express-wizard-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const typeSelect = document.getElementById('wizard-type');
    const vehicleSelect = document.getElementById('wizard-vehicle');
    const countryInput = document.getElementById('wizard-country');
    const durationSelect = document.getElementById('wizard-duration');

    const type = typeSelect ? typeSelect.value : 'SOAPEX';
    const vehicle = vehicleSelect ? vehicleSelect.value : 'Automóvil';
    const country = countryInput && countryInput.value.trim() ? countryInput.value.trim() : 'Extranjero';
    const duration = durationSelect ? durationSelect.value : '30 días';

    let msg = "";
    if (currentLang === 'es') {
      msg = `Hola Jeanette! Quisiera emitir o cotizar de forma express: ${type}. Vehículo: ${vehicle}, Matrícula/País: ${country}, Tiempo estimado: ${duration}. ¿Podrías indicarme los pasos?`;
    } else {
      msg = `Hello Jeanette! I would like to get a fast quote / issuance for: ${type}. Vehicle: ${vehicle}, Plate/Country: ${country}, Coverage period: ${duration}. Could you assist me with the next steps?`;
    }

    sendWhatsAppMessage(msg);
  });
}

/* ==========================================================================
   4. WHATSAPP INTELIGENTE CONTEXTUAL
   ========================================================================== */
function initWhatsApp() {
  const floatingBtn = document.getElementById('whatsapp-floating-btn');
  const heroBtn = document.getElementById('hero-wa-btn');
  const footerLink = document.getElementById('footer-wa-link');

  const handleWhatsAppClick = (e) => {
    e.preventDefault();
    let msg = "";

    if (activeCategory === 'travelers') {
      msg = currentLang === 'es'
        ? "Hola Jeanette, requiero cotizar o emitir un seguro de viaje / SOAPEX para ingresar a Chile con mi vehículo."
        : "Hello Jeanette, I need a quote or issuance for SOAPEX / Travel insurance to enter Chile with my vehicle.";
    } else if (activeCategory === 'business') {
      msg = currentLang === 'es'
        ? "Hola Jeanette, me gustaría recibir asesoría para seguros de empresas, garantías y colectivos de salud."
        : "Hello Jeanette, I would like advice regarding corporate insurance, surety bonds, and employee group health.";
    } else {
      msg = currentLang === 'es'
        ? "Hola Jeanette, me gustaría recibir asesoría fiduciaria para seguros personales y de familia."
        : "Hello Jeanette, I would like personal advisory regarding family and individual insurance coverage.";
    }

    sendWhatsAppMessage(msg);
  };

  if (floatingBtn) floatingBtn.addEventListener('click', handleWhatsAppClick);
  if (heroBtn) heroBtn.addEventListener('click', handleWhatsAppClick);
  if (footerLink) footerLink.addEventListener('click', handleWhatsAppClick);
}

function updateWhatsAppTooltip() {
  const tooltip = document.getElementById('whatsapp-tooltip-text');
  if (!tooltip) return;

  if (activeCategory === 'travelers') {
    tooltip.textContent = currentLang === 'es' ? "Consultar por SOAPEX & Viajes" : "Chat about SOAPEX & Travel";
  } else if (activeCategory === 'business') {
    tooltip.textContent = currentLang === 'es' ? "Asesoría para Empresas" : "Business Advisory";
  } else {
    tooltip.textContent = currentLang === 'es' ? "Asesoría con Jeanette" : "Chat with Jeanette";
  }
}

function sendWhatsAppMessage(text) {
  const url = `https://wa.me/${JEANETTE_PHONE}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* ==========================================================================
   5. MODAL DE CONTACTO & ALIANZAS
   ========================================================================== */
function initModals() {
  const backdrop = document.getElementById('contact-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const modalForm = document.getElementById('consultation-form');
  const modalTitle = document.getElementById('modal-title');
  const modalSubject = document.getElementById('form-subject');

  if (!backdrop) return;

  // Abrir modal desde botones de tarjetas y CTAs
  document.querySelectorAll('[data-open-modal]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const subject = trigger.getAttribute('data-subject') || 'General';
      if (modalSubject) modalSubject.value = subject;
      
      if (modalTitle) {
        if (subject.toLowerCase().includes('alianza') || subject.toLowerCase().includes('partner')) {
          modalTitle.textContent = currentLang === 'es' ? "Solicitud de Alianza Comercial B2B" : "B2B Partnership Inquiry";
        } else {
          modalTitle.textContent = currentLang === 'es' ? `Asesoría en ${subject}` : `Advisory for ${subject}`;
        }
      }

      backdrop.classList.add('active');
    });
  });

  // Cerrar modal
  if (closeBtn) {
    closeBtn.addEventListener('click', () => backdrop.classList.remove('active'));
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.remove('active');
  });

  // Envío del formulario
  if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('form-name').value;
      const phone = document.getElementById('form-phone').value;
      const email = document.getElementById('form-email').value;
      const subject = modalSubject.value;
      const notes = document.getElementById('form-notes').value;

      // Notificación al usuario
      showToast(currentLang === 'es' 
        ? "¡Solicitud recibida! Jeanette se comunicará contigo a la brevedad." 
        : "Inquiry received! Jeanette will reach out to you shortly.");
      
      backdrop.classList.remove('active');
      modalForm.reset();

      // Opción de enviar también a WhatsApp para atención inmediata
      setTimeout(() => {
        const confirmMsg = currentLang === 'es'
          ? `Hola Jeanette! Acabo de enviar una solicitud en tu web. Soy ${name}. Asunto: ${subject}. Teléfono: ${phone}. Email: ${email}. Comentario: ${notes}`
          : `Hello Jeanette! I just submitted an inquiry on your site. Name: ${name}. Topic: ${subject}. Phone: ${phone}. Notes: ${notes}`;
        sendWhatsAppMessage(confirmMsg);
      }, 700);
    });
  }
}

/* ==========================================================================
   6. TOAST NOTICES
   ========================================================================== */
function showToast(message) {
  let toast = document.getElementById('toast-notice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notice';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}
