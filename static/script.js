( () => {
var curves;
const CANDY_SIZES = [ 'XS', 'S', 'M', 'L', 'XL' ];
const SIZE_TITLES = [ 'Extra Small', 'Small', 'Medium', 'Large', 'Extra Large' ];
const calcExpToLv = ( curve, n ) => ( n <= 1 ) ? 0 : curves[ curve ]( n );
const clamp = ( num, lb, ub ) => Math.max( lb, Math.min( num, ub ) );
const fmtNum = ( num ) => num.toString().replace( /\B(?=(\d{3})+(?!\d))/g, ',' );
const toCamel = ( str ) => str.toLowerCase().replace( /\s+([a-z])/g, ( _, chr ) => chr.toUpperCase() );

curves = {
    fast: function( n ) {
        return Math.floor( Math.pow( n, 3 ) * 4 / 5 );
    },
    slow: function( n ) {
        return Math.floor( Math.pow( n, 3 ) * 5 / 4 );
    },
    mediumFast: function( n ) {
        return Math.pow( n, 3 );
    },
    mediumSlow: function( n ) {
        return Math.floor( Math.pow( n, 3 ) * 6 / 5 - Math.pow( n, 2 ) * 15 + n * 100 - 140 );
    },
    erratic: function( n ) {
        if ( n < 50 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 100 - n ) / 50 );
        } else if ( 50 <= n && n <= 68 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 150 - n ) / 100 );
        } else if ( 68 < n && n < 98 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 1911 - n * 10 ) / 1500 );
        }
        return Math.floor( Math.pow( n, 3 ) * ( 160 - n ) / 100 );
    },
    fluctuating: function( n ) {
        if ( n < 15 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 73 + n ) / 150 );
        } else if ( 15 <= n && n < 36 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 14 + n ) / 50 );
        }
        return Math.floor( Math.pow( n, 3 ) * ( 64 + n ) / 100 );
    }
}
    
function log( mssg = false ) {
    var $log = $( '#log' );
    if ( mssg ) {
        $log.removeAttr( 'hidden' )
            .text( mssg );
    } else {
        $log.attr( 'hidden', '' );
    }
    return $log;
}

function validate() {
    var currentLv, targetLv, disable = false;
    $( 'form [id^=result]' ).each( function() {
        $( this ).val( '-' );
    } );
    if ( !( $( '#curve' ).val().length ) ) {
        disable = 'Fill out the Pokémon species field.';
    } else {
        currentLv = parseInt( $( '#current' ).val() ),
        targetLv = parseInt( $( '#target' ).val() );
        if ( currentLv == targetLv ) {
            disable = 'Current Level cannot be equal to Target Level.';
        } else if ( currentLv > targetLv ) {
            disable = 'Current Level cannot exceed Target Level.';
        }
    }
    log( disable );
    $( '[type=submit]' ).prop( 'disabled', disable.length > 0 );
}
    
function testTimeout( start ) {
    var d, now = new Date();
    d = ( now.getTime() - start.getTime() ) / 1000;
    if ( d > 60 ) throw new Error( 'timeout' );
}

function optimize( problem ) {
    var lp, iocp, start, colname, colval, objval;
    
    start = new Date();

    lp = glp_create_prob();
    glp_read_lp_from_string( lp, null, problem );

    glp_scale_prob( lp, GLP_SF_AUTO );

    iocp = new IOCP( { presolve: GLP_ON } );
    glp_intopt( lp, iocp );

    try {
        objval = glp_mip_obj_val( lp );
        testTimeout( start );
        
        for( let i = 1; i <= glp_get_num_cols( lp ); i++ ){
            colname = glp_get_col_name( lp, i ),
            colval = glp_mip_col_val( lp, i );
            testTimeout( start );
            $( '#result-exp-candy-' + colname ).val( colval );
            objval -= colval;
        }
        return objval;
    } catch ( err ) {
        log( 'Timed out looking for a solution.' );
    }
}

$( document ).ready( function() {
    // read candy MILP problem
    $.get( 'https://richi3f.github.io/candy-calc/problem.txt', function( problemTemplate ) {
        var i, len;
        
        // read Pokémon names and experience curves
        $.getJSON( 'https://plan.pokemonteams.io/static/pokemon.json', function( pokemonData ) {
            var slug, slugs;

            // add each Pokémon to the datalist 
            slugs = Object.keys( pokemonData );
            len = slugs.length;
            for ( i = 0; i < len; i++ ) {
                slug = slugs[ i ];
                // ignore currently unobtainable Pokémon
                if ( pokemonData[ slug ].dex.swsh == 999 ) {
                    continue;
                }
                $( '<option>' )
                    .attr( 'value', pokemonData[ slug ].name )
                    .attr( 'data-exp-curve', pokemonData[ slug ].exp )
                    .appendTo( 'datalist' );
            }
            
            // show the experience curve when a Pokémon name is typed
            $( '#pokemon' ).on( 'input', function() {
                var value, $match;
                value = this.value;
                $match = $( 'datalist option' ).filter( function() {
                    return this.value.toUpperCase() == value.toUpperCase();
                } );
                if ( $match.length ) {
                    value = $( 'datalist option[value="' + $match.val() + '"]' ).attr( 'data-exp-curve' );
                    $( '#curve' ).val( value );
                } else {
                    $( '#curve' ).val( '' );
                }
                validate();
            } );

            // clear input on select
            $( '#pokemon' ).click( function() {
                var $curve = $( '#curve' );
                if ( $curve.val() ) {
                    $( this ).val( '' );
                    $curve.val( '' );
                    validate();
                }
            } );
        } );

        // create rows for candy in bag
        ( () => {
            var slug, target, template, $template;
            $template = $('#calc template');
            target = $template.attr('data-target');
            template = $template.html().trim();
            len = CANDY_SIZES.length;
            for ( i = 0; i < len; i++ ) {
                slug = 'exp-candy-' + CANDY_SIZES[ i ].toLowerCase();
                $template = $( template );
                $template.find( 'label' )
                    .attr( 'for', slug )
                    .append(
                        $( '<abbr></abbr>' )
                            .attr( 'title', SIZE_TITLES[ i ] + ' Experience Candy' )
                            .text( 'Exp. Candy' + CANDY_SIZES[ i ] )
                    );
                $template.find( 'input[type=number]' )
                    .attr( 'id', slug )
                    .attr( 'name', slug );
                $template.find( 'input[readonly]' )
                        .attr( 'id', 'result-' + slug );
                $template.appendTo( target );
            }
        } )();
        
        // restrict numerical input
        ( () => {
            $( 'input[type=number]' ).on( 'change', function() {
                var value, $this;
                value = parseInt( this.value );
                $this = $( this );
                if ( !isNaN( value ) ) {
                    value = clamp( value, $this.attr( 'min' ), $this.attr( 'max' ) );
                    $this.val( value );
                } else {
                    $this.val( $this.attr( 'min' ) );
                }
                validate();
            } );
        } )();

        // calculate optimal candy distribution
        ( () => {
            $( 'form' ).on( 'submit', function( evt ) {
                var expDiff, expCurrent, expTarget, curve, values, problem;
                values = {};
                evt.preventDefault();
                $.each( $( 'form' ).serializeArray(), function( _, field ) {
                    values[ field.name ] = field.value;
                } );
                curve = toCamel( values.curve );
                expCurrent = calcExpToLv( curve, parseInt( values.current ) );
                expTarget = calcExpToLv( curve, parseInt( values.target ) );
                expDiff = expTarget - expCurrent;

                problem = problemTemplate.replace( /{exp}/g, expDiff );
                len = CANDY_SIZES.length;
                for ( i = 0; i < len; i++ ) {
                    let size = CANDY_SIZES[ i ].toLowerCase();
                    problem = problem.replace( RegExp( '{' + size + '}' ), values[ 'exp-candy-' + size ] );
                }

                expCurrent = optimize( problem );
                expDiff = expCurrent - expDiff;

                if ( expDiff > 0 ) {
                    log( 'Solution found with a surplus of ' + fmtNum( expDiff ) + ' Exp. Points.' );
                } else if ( expDiff == 0 ) {
                    log( 'Optimal solution found! ' )
                        .append( $( '<a href="#">Click here to reset.</a>' ).click( function( evt ) {
                            evt.preventDefault();
                            $( '#calc form' ).trigger( 'reset' );
                            log();
                        } ) );
                } else {
                    log( 'No feasible solution found! Check if there is enough candy.' );
                }
            } );
        } )();

        validate();

    }, 'text' );
} );

} )();
