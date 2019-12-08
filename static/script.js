(function(){
var curves;
const CANDY_SIZES = [ 'XS', 'S', 'M', 'L', 'XL' ];
const toCamel = ( str ) => str.toLowerCase().replace( /\s+([a-z])/g, ( _, chr ) => chr.toUpperCase() );
const calcExpToLvl = ( curve, n ) => ( n <= 1 ) ? 0 : curves[ curve ]( n );

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
        } else {
            return Math.floor( Math.pow( n, 3 ) * ( 160 - n ) / 100 );
        }
    },
    fluctuating: function( n ) {
        if ( n < 15 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 73 + n ) / 150 );
        } else if ( 15 <= n && n < 36 ) {
            return Math.floor( Math.pow( n, 3 ) * ( 14 + n ) / 50 );
        } else {
            return Math.floor( Math.pow( n, 3 ) * ( 64 + n ) / 100 );
        }
    }
}

function validate() {
    var disable;
    disable = !( $( 'input[name=curve]' ).val().length ) || $( 'input[name=target]' ).val() < $( 'input[name=current]' ).val();
    $( '[type=submit]' ).prop( 'disabled', disable );
}

$(document).ready(function() {
    var i, len, template, $template;

    // read candy MILP
    $.get('https://raw.githubusercontent.com/richi3f/candy-calc/master/candy.txt', function(problem) {

        // read Pokémon names and experience curves
        $.getJSON( 'https://plan.pokemonteams.io/static/pokemon.json', function(pokemonData) {
            var slug, slugs;

            // add an option to the datalist for each Pokémon
            slugs = Object.keys( pokemonData );
            len = slugs.length;
            for ( i = 0; i < len; i++ ) {
                slug = slugs[i];
                if (pokemonData[slug].dex.swsh == 999) {
                    continue;
                }
                $( '<option>' )
                    .attr( 'value', pokemonData[slug].name )
                    .attr( 'data-exp-curve', pokemonData[slug].exp )
                    .appendTo( 'datalist' );
            }
            
            // show the experience curve when a Pokémon name is typed
            $( '#pokemon' ).on( 'input', function() {
                var value;
                value = this.value;
                if ( $( 'datalist option' ).filter(function() {
                    return this.value.toUpperCase() == value.toUpperCase();
                }).length ) {
                    value = $( 'datalist option[value="' + value + '"]' ).attr( 'data-exp-curve' );
                    $( 'input[name=curve]' ).val(value);
                } else {
                    $( 'input[name=curve]' ).val('');
                }
                validate();
            });
        });

        // create rows for candy in bag
        template = $('#candyrow').html().trim();
        len = CANDY_SIZES.length;
        for ( i = 0; i < len; i++ ) {
            let slug = 'exp-candy-' + CANDY_SIZES[i].toLowerCase();
            $template = $( template );
            $template.find( 'label' )
                .attr( 'for', slug )
                .text( 'Exp. Candy ' + CANDY_SIZES[i] );
            $template.find( 'input' )
                .attr( 'id', slug )
                .attr( 'name', slug );
            $template.appendTo( 'table tbody' );
        }

        // calculate optimal candy distribution
        $( 'form' ).on( 'submit', function( evt ) {
            var expDiff, curve, values;
            values = {};
            evt.preventDefault();
            $.each( $( 'form' ).serializeArray(), function( _, field ) {
                values[field.name] = field.value;
                console.log( field.name + ' = ' + field.value )
            });
            curve = toCamel(values.curve);
            expDiff = calcExpToLvl( curve, values.target ) - calcExpToLvl( curve, values.current );

            len = CANDY_SIZES.length;
            for ( i = 0; i < len; i++ ) {
                let size = CANDY_SIZES[i].toLowerCase();
                problem = problem.replace( RegExp( '{' + size + '}' ), values[ 'exp-candy-' + size ]);
            }
            problem = problem.replace( /{exp}/g, expDiff );


            alert(problem);
        });

    }, 'text');
});

})();
